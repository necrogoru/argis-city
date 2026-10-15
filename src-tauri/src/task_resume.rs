use crate::domain::{AgentSession, ProviderId, Snapshot, TaskAgentResume, TerminalAgent};
use crate::shared::liveness::canonical;
use crate::task_store::TaskStore;
use crate::terminal_manager::ManagedAgentProcess;
use std::collections::HashSet;
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
    use super::{native_reference, record_agent_session_references, reference_for_process};
    use crate::domain::{AgentSession, AgentStatus, Progress, ProviderId, Snapshot, TerminalAgent, TokenUsage};
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
}
