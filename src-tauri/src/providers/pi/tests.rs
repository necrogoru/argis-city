use super::discover::encode_cwd;
use super::transcript::PiState;
use super::PiProvider;
use crate::domain::{AgentStatus, ProgressSource};
use crate::providers::{AgentProvider, CollectContext};
use crate::shared::jsonl::LineFold;
use crate::system::clock::system_time_ms;
use crate::system::ProcessInfo;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::time::SystemTime;

fn header() -> Value {
    json!({"type": "session", "version": 3, "id": "s-1", "timestamp": "2026-09-29T16:45:45.725Z", "cwd": "/w/argis"})
}

fn user(text: &str) -> Value {
    json!({"type": "message", "message": {"role": "user", "content": [{"type": "text", "text": text}]}})
}

fn assistant(stop: &str, input: u64, output: u64, cr: u64, cw: u64) -> Value {
    json!({"type": "message", "message": {"role": "assistant", "model": "claude-x", "stopReason": stop,
        "content": [{"type": "toolCall", "name": "bash", "arguments": {"command": "ls"}}],
        "usage": {"input": input, "output": output, "cacheRead": cr, "cacheWrite": cw, "totalTokens": input + output + cr + cw}}})
}

fn fold(lines: &[Value]) -> PiState {
    let mut s = PiState::default();
    lines.iter().for_each(|l| s.apply(l));
    s
}

#[test]
fn sums_usage_and_tracks_context() {
    let s =
        fold(&[header(), user("hi"), assistant("toolUse", 10, 5, 100, 20), assistant("stop", 3, 2, 130, 0)]).summary();
    assert_eq!((s.tokens.input, s.tokens.output, s.tokens.cache_read, s.tokens.cache_write), (13, 7, 230, 20));
    assert_eq!(s.tokens.total, 270);
    assert_eq!((s.tokens.context_used, s.tokens.context_window), (Some(133), None));
    assert_eq!((s.id.as_deref(), s.started_ms), (Some("s-1"), Some(1_790_700_345_725)));
    assert_eq!(
        (s.title.as_deref(), s.model.as_deref(), s.step.as_deref()),
        (Some("hi"), Some("claude-x"), Some("bash: ls"))
    );
}

#[test]
fn maps_stop_reasons() {
    assert_eq!(fold(&[assistant("toolUse", 0, 0, 0, 0)]).status(), AgentStatus::Running);
    assert_eq!(fold(&[assistant("stop", 0, 0, 0, 0)]).status(), AgentStatus::Idle);
    assert_eq!(fold(&[assistant("error", 0, 0, 0, 0)]).status(), AgentStatus::Error);
    let failed = json!({"type": "message", "message": {"role": "assistant", "stopReason": "error", "errorMessage": "Token is expired."}});
    assert_eq!(fold(&[failed]).summary().step.as_deref(), Some("Token is expired."));
    assert_eq!(fold(&[assistant("aborted", 0, 0, 0, 0)]).status(), AgentStatus::Idle);
    assert_eq!(fold(&[assistant("stop", 0, 0, 0, 0), user("next")]).status(), AgentStatus::Running);
    let tool_result = json!({"type": "message", "message": {"role": "toolResult", "content": []}});
    assert_eq!(fold(&[assistant("toolUse", 0, 0, 0, 0), tool_result]).status(), AgentStatus::Running);
    assert_eq!(fold(&[header()]).status(), AgentStatus::Idle);
}

#[test]
fn encodes_cwd_like_pi() {
    assert_eq!(encode_cwd(Path::new("/Users/me/Sites/argis")), "--Users-me-Sites-argis--");
}

#[test]
fn provider_matches_process_by_cwd_dir() {
    let root = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    let cwd = crate::shared::liveness::canonical(work.path());
    let dir = root.path().join("sessions").join(encode_cwd(&cwd));
    fs::create_dir_all(&dir).unwrap();
    let lines = [header(), user("Refactor"), assistant("stop", 1, 1, 1, 1)];
    fs::write(dir.join("2026_s-1.jsonl"), lines.iter().map(|l| format!("{l}\n")).collect::<String>()).unwrap();
    let now = system_time_ms(SystemTime::now());
    let proc = ProcessInfo {
        pid: 31,
        parent_pid: None,
        name: "node".into(),
        cmd: vec!["node".into(), "/opt/bin/pi".into()],
        cwd: Some(cwd.clone()),
        started_at_ms: now - 60_000,
    };
    let provider = PiProvider::new(root.path().to_path_buf());
    // Not recent enough for the fallback, but owned by the process.
    let later = now + 10 * 60_000;
    let sessions = provider.collect(&CollectContext { processes: vec![proc], now_ms: later }).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!((s.id.as_str(), s.title.as_str(), s.pid, s.status), ("pi:s-1", "Refactor", Some(31), AgentStatus::Idle));
    assert_eq!((s.tokens.total, s.progress.source), (4, ProgressSource::None));
    assert!(s.subagents.is_empty());
    // Without the process and long after the last write: not live.
    assert!(provider.collect(&CollectContext { processes: vec![], now_ms: later }).unwrap().is_empty());
}
