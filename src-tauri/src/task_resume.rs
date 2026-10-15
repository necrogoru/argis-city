use crate::domain::{
    AgentSession, ProviderId, Snapshot, TaskAgentResume, TerminalAgent, TerminalSessionKey, TerminalSize, TerminalTab,
};
use crate::shared::liveness::canonical;
use crate::system::HomePaths;
use crate::task_store::TaskStore;
use crate::terminal_manager::{ManagedAgentProcess, TerminalProcessSpec};
use anyhow::{bail, Context};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

/// Binds a provider snapshot entry to a live Argis-launched Agent process.
/// Old sessions in the same worktree cannot match because their native start time predates the PTY.
pub(crate) fn reference_for_process(snapshot: &Snapshot, process: &ManagedAgentProcess) -> Option<TaskAgentResume> {
    let provider = provider_id(process.agent_cli);
    let expected_cwd = canonical(&process.cwd);
    let candidates = snapshot
        .sessions
        .iter()
        .filter(|session| {
            session.provider == provider
                && session.pid == Some(process.process_id)
                && canonical(Path::new(&session.cwd)) == expected_cwd
                && session.started_at >= process.started_at_ms.saturating_sub(2_000)
        })
        .filter_map(|session| native_reference(session).map(|native| (session, native)));
    let mut candidates = candidates;
    let (_, native_reference) = candidates.next()?;
    if candidates.next().is_some() {
        return None;
    }

    Some(TaskAgentResume {
        task_id: process.task_id,
        provider,
        native_reference,
        worktree_path: expected_cwd.to_string_lossy().into_owned(),
        last_observed_at_ms: snapshot.generated_at,
    })
}

/// Persists newly identified references once per Argis PTY/session pair.
pub(crate) fn record_agent_session_references(
    snapshot: &Snapshot,
    processes: &[ManagedAgentProcess],
    store: &TaskStore,
    observed: &mut HashSet<(u64, String)>,
) {
    let active_session_ids: HashSet<u64> = processes.iter().map(|process| process.terminal_session_id).collect();
    observed.retain(|(terminal_session_id, _)| active_session_ids.contains(terminal_session_id));

    for process in processes {
        let Some(reference) = reference_for_process(snapshot, process) else { continue };
        let key = (process.terminal_session_id, reference.native_reference.clone());
        if observed.contains(&key) {
            continue;
        }
        match store.save_task_agent_resume(&reference) {
            Ok(()) => {
                observed.insert(key);
            }
            Err(error) => eprintln!("failed to save task agent resume reference: {error}"),
        }
    }
}

fn provider_id(agent: TerminalAgent) -> ProviderId {
    match agent {
        TerminalAgent::Claude => ProviderId::Claude,
        TerminalAgent::Codex => ProviderId::Codex,
        TerminalAgent::OpenCode => ProviderId::Opencode,
        TerminalAgent::Pi => ProviderId::Pi,
    }
}

pub(crate) fn resume_process_spec(
    task_id: i64,
    reference: &TaskAgentResume,
    task_worktree: &Path,
    size: TerminalSize,
) -> anyhow::Result<TerminalProcessSpec> {
    if reference.task_id != task_id {
        bail!("agent resume reference belongs to a different task");
    }
    if !validate_reference_identifier(reference.provider, &reference.native_reference) {
        bail!("agent resume reference is invalid");
    }
    if reference.last_observed_at_ms < 0 {
        bail!("agent resume timestamp is invalid");
    }

    let task_worktree = fs::canonicalize(task_worktree).context("resolving task worktree")?;
    let reference_worktree = fs::canonicalize(&reference.worktree_path).context("resolving saved resume worktree")?;
    if task_worktree != reference_worktree {
        bail!("agent resume reference belongs to a different task worktree");
    }

    let agent_cli = terminal_agent(reference.provider);
    let args = match reference.provider {
        ProviderId::Claude => vec!["--resume".to_owned(), reference.native_reference.clone()],
        ProviderId::Codex => vec!["resume".to_owned(), reference.native_reference.clone()],
        ProviderId::Opencode => vec!["--session".to_owned(), reference.native_reference.clone()],
        ProviderId::Pi => vec!["--session".to_owned(), reference.native_reference.clone()],
    };

    Ok(TerminalProcessSpec {
        key: TerminalSessionKey { task_id, tab: TerminalTab::Agent },
        agent_cli: Some(agent_cli),
        program: agent_cli.executable().into(),
        args,
        cwd: task_worktree,
        size,
    })
}

pub(crate) fn validate_reference_identifier(provider: ProviderId, native: &str) -> bool {
    valid_native_reference(provider, native)
}

pub(crate) fn ensure_provider_reference_exists(
    paths: &HomePaths,
    reference: &TaskAgentResume,
    worktree: &Path,
) -> anyhow::Result<()> {
    if !validate_reference_identifier(reference.provider, &reference.native_reference) {
        bail!("agent resume reference is invalid");
    }

    let exists = match reference.provider {
        ProviderId::Claude => {
            crate::providers::claude::has_resume_reference(&paths.claude, &reference.native_reference)
        }
        ProviderId::Codex => {
            crate::providers::codex::has_resume_reference(&paths.codex, &reference.native_reference, worktree)?
        }
        ProviderId::Opencode => {
            crate::providers::opencode::has_resume_reference(&paths.opencode, &reference.native_reference, worktree)?
        }
        ProviderId::Pi => crate::providers::pi::has_resume_reference(&paths.pi, &reference.native_reference, worktree),
    };
    if !exists {
        bail!("saved provider conversation is no longer available for this task worktree");
    }
    Ok(())
}

fn terminal_agent(provider: ProviderId) -> TerminalAgent {
    match provider {
        ProviderId::Claude => TerminalAgent::Claude,
        ProviderId::Codex => TerminalAgent::Codex,
        ProviderId::Opencode => TerminalAgent::OpenCode,
        ProviderId::Pi => TerminalAgent::Pi,
    }
}

fn native_reference(session: &AgentSession) -> Option<String> {
    let (prefix, native) = session.id.split_once(':')?;
    if prefix != session.provider.as_str() || !valid_native_reference(session.provider, native) {
        return None;
    }
    Some(native.to_owned())
}

fn valid_native_reference(provider: ProviderId, native: &str) -> bool {
    if native.is_empty()
        || native.len() > 256
        || native
            .chars()
            .any(|character| character.is_control() || character.is_whitespace() || matches!(character, '/' | '\\'))
    {
        return false;
    }

    match provider {
        ProviderId::Claude | ProviderId::Codex => is_uuid(native),
        ProviderId::Opencode => native
            .strip_prefix("ses_")
            .is_some_and(|suffix| !suffix.is_empty() && suffix.bytes().all(is_native_id_byte)),
        ProviderId::Pi => native.bytes().all(is_native_id_byte),
    }
}

fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && [8, 13, 18, 23].into_iter().all(|index| bytes[index] == b'-')
        && bytes.iter().enumerate().all(|(index, byte)| [8, 13, 18, 23].contains(&index) || byte.is_ascii_hexdigit())
}

fn is_native_id_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-')
}

#[cfg(test)]
mod tests {
    use super::{
        ensure_provider_reference_exists, native_reference, record_agent_session_references, reference_for_process,
        resume_process_spec,
    };
    use crate::domain::{
        AgentSession, AgentStatus, Progress, ProviderId, Snapshot, TaskAgentResume, TerminalAgent, TerminalSize,
        TerminalTab, TokenUsage,
    };
    use crate::system::HomePaths;
    use crate::task_store::TaskStore;
    use crate::terminal_manager::ManagedAgentProcess;
    use std::collections::HashSet;
    use std::path::{Path, PathBuf};

    fn session(id: &str, provider: &str, pid: u32, cwd: &str, started_at: i64) -> crate::domain::AgentSession {
        let provider = match provider {
            "claude" => ProviderId::Claude,
            "codex" => ProviderId::Codex,
            "opencode" => ProviderId::Opencode,
            "pi" => ProviderId::Pi,
            _ => panic!("unsupported test provider"),
        };
        AgentSession {
            id: id.to_owned(),
            provider,
            title: "Task".to_owned(),
            cwd: cwd.to_owned(),
            model: None,
            pid: Some(pid),
            status: AgentStatus::Running,
            tokens: TokenUsage::default(),
            progress: Progress::none(),
            current_step: None,
            started_at,
            updated_at: started_at,
            subagents: Vec::new(),
        }
    }

    fn snapshot(sessions: Vec<crate::domain::AgentSession>) -> Snapshot {
        Snapshot { generated_at: 9_000, sessions, providers: Vec::new() }
    }

    fn process(agent_cli: TerminalAgent, pid: u32, cwd: &Path, started_at_ms: i64) -> ManagedAgentProcess {
        ManagedAgentProcess {
            terminal_session_id: 42,
            task_id: 7,
            agent_cli,
            process_id: pid,
            started_at_ms,
            cwd: cwd.to_path_buf(),
        }
    }

    #[test]
    fn provider_ids_extract_only_valid_native_references() {
        let id = "12345678-1234-4abc-8def-123456789abc";
        for (provider, prefix, native) in
            [("claude", "claude", id), ("codex", "codex", id), ("opencode", "opencode", "ses_abc123"), ("pi", "pi", id)]
        {
            let session = session(&format!("{prefix}:{native}"), provider, 11, "/worktree", 1_000);
            assert_eq!(native_reference(&session).as_deref(), Some(native));
        }

        let malformed = session("codex:../wrong", "codex", 11, "/worktree", 1_000);
        let wrong_provider = session(&format!("claude:{id}"), "codex", 11, "/worktree", 1_000);
        assert_eq!(native_reference(&malformed), None);
        assert_eq!(native_reference(&wrong_provider), None);
        assert_eq!(ProviderId::from_str("future-cli"), None);
    }

    #[test]
    fn same_worktree_concurrent_sessions_bind_to_the_exact_process_and_ignore_old_sessions() {
        let cwd = tempfile::tempdir().unwrap();
        let old_id = "12345678-1234-4abc-8def-123456789001";
        let argis_id = "12345678-1234-4abc-8def-123456789002";
        let external_id = "12345678-1234-4abc-8def-123456789003";
        let snapshot = snapshot(vec![
            session(&format!("claude:{old_id}"), "claude", 100, cwd.path().to_str().unwrap(), 100),
            session(&format!("claude:{argis_id}"), "claude", 200, cwd.path().to_str().unwrap(), 2_100),
            session(&format!("claude:{external_id}"), "claude", 300, cwd.path().to_str().unwrap(), 2_200),
        ]);

        let reference = reference_for_process(&snapshot, &process(TerminalAgent::Claude, 200, cwd.path(), 2_000))
            .expect("the exact Argis process owns one fresh session");

        assert_eq!(reference.native_reference, argis_id);
        assert_eq!(reference.worktree_path, cwd.path().canonicalize().unwrap().to_string_lossy());
    }

    #[test]
    fn session_discovery_is_unavailable_for_missing_mismatched_or_ambiguous_process_sessions() {
        let cwd = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let session_id = "12345678-1234-4abc-8def-123456789004";
        let running = process(TerminalAgent::Claude, 200, cwd.path(), 2_000);

        assert_eq!(reference_for_process(&snapshot(Vec::new()), &running), None);
        assert_eq!(
            reference_for_process(
                &snapshot(vec![session(
                    &format!("claude:{session_id}"),
                    "claude",
                    300,
                    cwd.path().to_str().unwrap(),
                    2_100
                )]),
                &running
            ),
            None
        );
        assert_eq!(
            reference_for_process(
                &snapshot(vec![session(
                    &format!("claude:{session_id}"),
                    "claude",
                    200,
                    other.path().to_str().unwrap(),
                    2_100
                )]),
                &running
            ),
            None
        );
        assert_eq!(
            reference_for_process(
                &snapshot(vec![
                    session(&format!("claude:{session_id}"), "claude", 200, cwd.path().to_str().unwrap(), 2_100),
                    session(
                        "claude:12345678-1234-4abc-8def-123456789005",
                        "claude",
                        200,
                        cwd.path().to_str().unwrap(),
                        2_200
                    ),
                ]),
                &running
            ),
            None
        );
    }

    #[test]
    fn identified_native_reference_is_persisted_once_for_the_argis_terminal_session() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
        let project = store.create_project("/projects/argis").unwrap();
        let task = store.create_task(project.id, "Resume", "").unwrap();
        let process = process(TerminalAgent::Codex, 22, cwd.path(), 2_000);
        let session_id = "12345678-1234-4abc-8def-123456789006";
        let snapshot =
            snapshot(vec![session(&format!("codex:{session_id}"), "codex", 22, cwd.path().to_str().unwrap(), 2_100)]);
        let mut process = process;
        process.task_id = task.id;
        let mut observed = HashSet::new();

        record_agent_session_references(&snapshot, &[process], &store, &mut observed);

        let saved = store.get_task_agent_resume(task.id).unwrap().unwrap();
        assert_eq!(saved.provider.as_str(), "codex");
        assert_eq!(saved.native_reference, session_id);
        assert_eq!(saved.last_observed_at_ms, snapshot.generated_at);
        assert_eq!(observed.len(), 1);
        assert_eq!(PathBuf::from(saved.worktree_path).canonicalize().unwrap(), cwd.path().canonicalize().unwrap());
    }

    #[test]
    fn missing_or_ambiguous_provider_sessions_do_not_persist_a_resume_reference() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();
        let project = store.create_project("/projects/argis").unwrap();
        let task = store.create_task(project.id, "Resume", "").unwrap();
        let process = process(TerminalAgent::OpenCode, 23, cwd.path(), 2_000);
        let process = ManagedAgentProcess { task_id: task.id, ..process };
        let session_id_a = "ses_candidate_a";
        let session_id_b = "ses_candidate_b";
        let ambiguous = snapshot(vec![
            session(&format!("opencode:{session_id_a}"), "opencode", 23, cwd.path().to_str().unwrap(), 2_100),
            session(&format!("opencode:{session_id_b}"), "opencode", 23, cwd.path().to_str().unwrap(), 2_200),
        ]);
        let mut observed = HashSet::new();

        record_agent_session_references(&ambiguous, std::slice::from_ref(&process), &store, &mut observed);
        record_agent_session_references(&snapshot(Vec::new()), &[process], &store, &mut observed);

        assert!(store.list_task_agent_resumes().unwrap().is_empty());
        assert!(observed.is_empty());
    }

    #[test]
    fn resume_specs_use_provider_native_argument_vectors() {
        let cwd = tempfile::tempdir().unwrap();
        let native_ids = [
            (
                ProviderId::Claude,
                "12345678-1234-4abc-8def-123456789010",
                vec!["--resume", "12345678-1234-4abc-8def-123456789010"],
            ),
            (
                ProviderId::Codex,
                "12345678-1234-4abc-8def-123456789011",
                vec!["resume", "12345678-1234-4abc-8def-123456789011"],
            ),
            (ProviderId::Opencode, "ses_abc123", vec!["--session", "ses_abc123"]),
            (ProviderId::Pi, "s-12", vec!["--session", "s-12"]),
        ];

        for (provider, native_reference, expected_args) in native_ids {
            let reference = TaskAgentResume {
                task_id: 17,
                provider,
                native_reference: native_reference.to_owned(),
                worktree_path: cwd.path().canonicalize().unwrap().to_string_lossy().into_owned(),
                last_observed_at_ms: 2_000,
            };
            let spec = resume_process_spec(17, &reference, cwd.path(), TerminalSize::default()).unwrap();
            let agent = provider_to_agent(provider);

            assert_eq!(spec.key.task_id, 17);
            assert_eq!(spec.key.tab, TerminalTab::Agent);
            assert_eq!(spec.agent_cli, Some(agent));
            assert_eq!(spec.program, PathBuf::from(agent.executable()));
            assert_eq!(spec.args, expected_args.into_iter().map(str::to_owned).collect::<Vec<_>>());
            assert_eq!(spec.cwd, cwd.path().canonicalize().unwrap());
        }
    }

    #[test]
    fn resume_specs_reject_invalid_native_ids_task_ids_and_worktree_bindings() {
        let cwd = tempfile::tempdir().unwrap();
        let other_worktree = tempfile::tempdir().unwrap();
        let canonical_cwd = cwd.path().canonicalize().unwrap().to_string_lossy().into_owned();
        let valid = TaskAgentResume {
            task_id: 17,
            provider: ProviderId::Claude,
            native_reference: "12345678-1234-4abc-8def-123456789012".to_owned(),
            worktree_path: canonical_cwd,
            last_observed_at_ms: 2_000,
        };

        assert!(resume_process_spec(18, &valid, cwd.path(), TerminalSize::default()).is_err());
        assert!(resume_process_spec(
            17,
            &TaskAgentResume { native_reference: "../other-session".to_owned(), ..valid.clone() },
            cwd.path(),
            TerminalSize::default()
        )
        .is_err());
        assert!(resume_process_spec(
            17,
            &TaskAgentResume {
                worktree_path: other_worktree.path().canonicalize().unwrap().to_string_lossy().into_owned(),
                ..valid
            },
            cwd.path(),
            TerminalSize::default()
        )
        .is_err());
    }

    #[test]
    fn resume_is_unavailable_when_the_native_provider_record_is_stale() {
        let home = tempfile::tempdir().unwrap();
        let worktree = tempfile::tempdir().unwrap();
        let paths = HomePaths::from_home(home.path());
        let reference = TaskAgentResume {
            task_id: 17,
            provider: ProviderId::Claude,
            native_reference: "12345678-1234-4abc-8def-123456789013".to_owned(),
            worktree_path: worktree.path().canonicalize().unwrap().to_string_lossy().into_owned(),
            last_observed_at_ms: 2_000,
        };

        assert!(ensure_provider_reference_exists(&paths, &reference, worktree.path()).is_err());
    }

    fn provider_to_agent(provider: ProviderId) -> TerminalAgent {
        match provider {
            ProviderId::Claude => TerminalAgent::Claude,
            ProviderId::Codex => TerminalAgent::Codex,
            ProviderId::Opencode => TerminalAgent::OpenCode,
            ProviderId::Pi => TerminalAgent::Pi,
        }
    }
}
