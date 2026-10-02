//! `~/.claude/sessions/<pid>.json` — Claude Code's live-session registry.

use crate::domain::AgentStatus;
use crate::system::ProcessInfo;
use serde::Deserialize;
use std::fs;
use std::path::Path;

/// Tolerance between process start and the registry's `startedAt`.
const START_SLACK_MS: i64 = 5_000;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryEntry {
    pub pid: u32,
    pub session_id: String,
    pub cwd: String,
    pub started_at: i64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub updated_at: Option<i64>,
}

/// All parseable registry entries; malformed files are skipped.
pub fn read_registry(dir: &Path) -> Vec<RegistryEntry> {
    let Ok(read) = fs::read_dir(dir) else { return Vec::new() };
    read.flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .filter_map(|p| fs::read(&p).ok())
        .filter_map(|bytes| serde_json::from_slice::<RegistryEntry>(&bytes).ok())
        .collect()
}

/// Entries whose pid is alive and was not reused by a later process.
pub fn live_entries(entries: Vec<RegistryEntry>, processes: &[ProcessInfo]) -> Vec<(RegistryEntry, &ProcessInfo)> {
    entries
        .into_iter()
        .filter_map(|e| {
            let proc = processes.iter().find(|p| p.pid == e.pid)?;
            (proc.started_at_ms <= e.started_at + START_SLACK_MS).then_some((e, proc))
        })
        .collect()
}

/// `busy`→running, `idle`→idle; anything about waiting/permission/approval
/// means the session is blocked on the user.
pub fn registry_status(raw: Option<&str>) -> AgentStatus {
    let s = raw.unwrap_or("").to_ascii_lowercase();
    if ["wait", "permission", "approval"].iter().any(|k| s.contains(k)) {
        AgentStatus::AwaitingApproval
    } else if s.contains("error") {
        AgentStatus::Error
    } else if ["busy", "running", "working"].iter().any(|k| s.contains(k)) {
        AgentStatus::Running
    } else {
        AgentStatus::Idle
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(pid: u32, started: i64) -> ProcessInfo {
        ProcessInfo { pid, parent_pid: None, name: "claude".into(), cmd: vec![], cwd: None, started_at_ms: started }
    }

    #[test]
    fn maps_statuses() {
        assert_eq!(registry_status(Some("busy")), AgentStatus::Running);
        assert_eq!(registry_status(Some("idle")), AgentStatus::Idle);
        assert_eq!(registry_status(Some("waiting_for_permission")), AgentStatus::AwaitingApproval);
        assert_eq!(registry_status(Some("needs-approval")), AgentStatus::AwaitingApproval);
        assert_eq!(registry_status(None), AgentStatus::Idle);
    }

    #[test]
    fn reads_registry_and_filters_dead_or_reused_pids() {
        let dir = tempfile::tempdir().unwrap();
        let entry = |pid: u32| {
            format!(r#"{{"pid":{pid},"sessionId":"s{pid}","cwd":"/x","startedAt":10000,"status":"busy","extra":1}}"#)
        };
        fs::write(dir.path().join("1.json"), entry(1)).unwrap();
        fs::write(dir.path().join("2.json"), entry(2)).unwrap();
        fs::write(dir.path().join("3.json"), entry(3)).unwrap();
        fs::write(dir.path().join("bad.json"), "{nope").unwrap();
        let entries = read_registry(dir.path());
        assert_eq!(entries.len(), 3);
        let procs = vec![proc(1, 9_000), proc(2, 60_000)];
        let live = live_entries(entries, &procs);
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].0.session_id, "s1");
    }
}
