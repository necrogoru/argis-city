use super::status::{session_status, subagent_status, StatusEnv};
use super::transcript::{TranscriptState, TranscriptSummary};
use super::ClaudeProvider;
use crate::domain::{AgentStatus, PlanCounts, ProgressSource};
use crate::providers::{AgentProvider, CollectContext};
use crate::shared::jsonl::LineFold;
use crate::system::ProcessInfo;
use serde_json::{json, Value};
use std::fs;

const T0: &str = "2026-10-01T20:00:00.000Z";
const T0_MS: i64 = 1_790_884_800_000;

fn assistant(id: &str, content: Value, usage: Value, stop: Value) -> Value {
    json!({"type": "assistant", "timestamp": T0, "message": {
        "id": id, "model": "claude-opus-5-5", "content": content, "usage": usage, "stop_reason": stop}})
}

fn usage(input: u64, output: u64, cr: u64, cw: u64) -> Value {
    json!({"input_tokens": input, "output_tokens": output, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cw})
}

fn tool_use(id: &str, name: &str, input: Value) -> Value {
    json!([{"type": "tool_use", "id": id, "name": name, "input": input}])
}

fn tool_result(id: &str) -> Value {
    json!({"type": "user", "timestamp": T0, "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": id}]}})
}

fn fold(lines: &[Value]) -> TranscriptSummary {
    let mut state = TranscriptState::default();
    lines.iter().for_each(|l| state.apply(l));
    state.summary()
}

#[test]
fn tokens_dedupe_by_message_id_and_context_uses_last_turn() {
    let text = json!([{"type": "text", "text": "hi"}]);
    let s = fold(&[
        assistant("m1", json!([{"type": "thinking"}]), usage(10, 5, 1000, 50), Value::Null),
        assistant("m1", text.clone(), usage(10, 9, 1000, 50), json!("end_turn")),
        assistant("m2", text, usage(3, 4, 2000, 0), json!("end_turn")),
    ]);
    assert_eq!((s.tokens.input, s.tokens.output, s.tokens.cache_read, s.tokens.cache_write), (13, 13, 3000, 50));
    assert_eq!(s.tokens.context_used, Some(2003));
    assert_eq!(s.tokens.context_window, Some(200_000));
    assert_eq!(s.model.as_deref(), Some("claude-opus-5-5"));
    assert!(s.ended_turn);
}

#[test]
fn one_million_window_from_cost_state() {
    let s = fold(&[
        assistant("m1", json!([]), usage(1, 1, 1, 1), Value::Null),
        json!({"type": "cost-state", "modelUsage": {"claude-opus-5-5[1m]": {}}}),
    ]);
    assert_eq!(s.tokens.context_window, Some(1_000_000));
    assert_eq!(s.model.as_deref(), Some("claude-opus-5-5[1m]"));
}

#[test]
fn todo_write_drives_plan_and_titles_come_from_custom_title() {
    let todos = json!({"todos": [{"status": "completed"}, {"status": "in_progress"}, {"status": "pending"}]});
    let s = fold(&[
        json!({"type": "agent-name", "agentName": "agent"}),
        json!({"type": "custom-title", "customTitle": "argis"}),
        assistant("m1", tool_use("t1", "TodoWrite", todos), usage(1, 1, 0, 0), json!("tool_use")),
        tool_result("t1"),
    ]);
    assert_eq!(s.plan, Some(PlanCounts { completed: 1, total: 3 }));
    assert_eq!(s.title.as_deref(), Some("argis"));
    assert_eq!(s.blocking_tool, None);
}

fn env(now_ms: i64, processes: &[ProcessInfo]) -> StatusEnv<'_> {
    StatusEnv { now_ms, pid: 100, processes }
}

#[test]
fn awaiting_approval_needs_stale_unanswered_tool_use_while_busy() {
    let pending = fold(&[assistant(
        "m1",
        tool_use("t1", "Bash", json!({"command": "rm -rf x"})),
        usage(1, 1, 0, 0),
        Value::Null,
    )]);
    assert_eq!(pending.step.as_deref(), Some("Bash: rm -rf x"));
    let stale = T0_MS + 9_000;
    assert_eq!(session_status(AgentStatus::Running, &pending, T0_MS, &env(stale, &[])), AgentStatus::AwaitingApproval);
    // Fresh write, idle registry, or a child process running the tool: not awaiting.
    assert_eq!(session_status(AgentStatus::Running, &pending, T0_MS, &env(T0_MS + 3_000, &[])), AgentStatus::Running);
    assert_eq!(session_status(AgentStatus::Idle, &pending, T0_MS, &env(stale, &[])), AgentStatus::Idle);
    let child = ProcessInfo {
        pid: 5,
        parent_pid: Some(100),
        name: "zsh".into(),
        cmd: vec![],
        cwd: None,
        started_at_ms: T0_MS + 500,
    };
    assert_eq!(session_status(AgentStatus::Running, &pending, T0_MS, &env(stale, &[child])), AgentStatus::Running);
    // Answered tool call: not awaiting.
    let answered =
        fold(&[assistant("m1", tool_use("t1", "Bash", json!({})), usage(1, 1, 0, 0), Value::Null), tool_result("t1")]);
    assert_eq!(session_status(AgentStatus::Running, &answered, T0_MS, &env(stale, &[])), AgentStatus::Running);
}

#[test]
fn bypass_mode_and_subagent_tools_never_await_but_questions_do() {
    let bypass = json!({"type": "permission-mode", "permissionMode": "bypassPermissions"});
    let stale = env(T0_MS + 60_000, &[]);
    let bash =
        fold(&[bypass.clone(), assistant("m", tool_use("t", "Bash", json!({})), usage(0, 0, 0, 0), Value::Null)]);
    assert_eq!(session_status(AgentStatus::Running, &bash, T0_MS, &stale), AgentStatus::Running);
    let ask =
        fold(&[bypass, assistant("m", tool_use("t", "AskUserQuestion", json!({})), usage(0, 0, 0, 0), Value::Null)]);
    assert_eq!(session_status(AgentStatus::Running, &ask, T0_MS, &stale), AgentStatus::AwaitingApproval);
    let agent = fold(&[assistant("m", tool_use("t", "Agent", json!({})), usage(0, 0, 0, 0), Value::Null)]);
    assert_eq!(session_status(AgentStatus::Running, &agent, T0_MS, &stale), AgentStatus::Running);
}

#[test]
fn subagent_statuses() {
    let done = fold(&[assistant("m", json!([{"type": "text", "text": "ok"}]), usage(0, 0, 0, 0), json!("end_turn"))]);
    let e = env(T0_MS + 60_000, &[]);
    assert_eq!(subagent_status(&done, T0_MS, AgentStatus::Running, &e), AgentStatus::Done);
    let working = fold(&[assistant("m", json!([{"type": "thinking"}]), usage(0, 0, 0, 0), Value::Null)]);
    assert_eq!(subagent_status(&working, T0_MS + 50_000, AgentStatus::Running, &e), AgentStatus::Running);
    assert_eq!(subagent_status(&working, T0_MS, AgentStatus::Running, &e), AgentStatus::Idle);
    let pending = fold(&[assistant("m", tool_use("t", "Edit", json!({})), usage(0, 0, 0, 0), Value::Null)]);
    assert_eq!(subagent_status(&pending, T0_MS, AgentStatus::Running, &e), AgentStatus::AwaitingApproval);
    assert_eq!(subagent_status(&pending, T0_MS, AgentStatus::Idle, &e), AgentStatus::Idle);
}

#[test]
fn provider_collects_live_sessions_with_subagents() {
    let home = tempfile::tempdir().unwrap();
    let root = home.path().join(".claude");
    let project = root.join("projects/-tmp-proj");
    fs::create_dir_all(root.join("sessions")).unwrap();
    fs::create_dir_all(project.join("s1/subagents")).unwrap();
    let entry =
        json!({"pid": 100, "sessionId": "s1", "cwd": "/tmp/proj", "startedAt": 1000, "name": "proj", "status": "idle"});
    fs::write(root.join("sessions/100.json"), entry.to_string()).unwrap();
    let dead = json!({"pid": 999, "sessionId": "s2", "cwd": "/x", "startedAt": 1000, "status": "busy"});
    fs::write(root.join("sessions/999.json"), dead.to_string()).unwrap();
    let todos = json!({"todos": [{"status": "completed"}, {"status": "pending"}]});
    let lines = [
        assistant("m1", tool_use("t1", "TodoWrite", todos), usage(100, 10, 0, 0), json!("tool_use")),
        tool_result("t1"),
        assistant("m2", json!([{"type": "text", "text": "Done."}]), usage(5, 5, 100, 0), json!("end_turn")),
    ];
    let jsonl: String = lines.iter().map(|l| format!("{l}\n")).collect();
    fs::write(project.join("s1.jsonl"), &jsonl).unwrap();
    fs::write(project.join("s1/subagents/agent-a1.jsonl"), &jsonl).unwrap();
    fs::write(project.join("s1/subagents/agent-a1.meta.json"), r#"{"agentType":"Explore","description":"Scan repo"}"#)
        .unwrap();

    let proc =
        ProcessInfo { pid: 100, parent_pid: None, name: "claude".into(), cmd: vec![], cwd: None, started_at_ms: 500 };
    let ctx = CollectContext { processes: vec![proc], now_ms: T0_MS };
    let provider = ClaudeProvider::new(root);
    assert!(provider.is_available());
    let sessions = provider.collect(&ctx).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!((s.id.as_str(), s.title.as_str(), s.status), ("claude:s1", "proj", AgentStatus::Idle));
    assert_eq!(s.tokens.total, 220);
    assert_eq!((s.progress.source, s.progress.percent), (ProgressSource::Plan, Some(50.0)));
    assert_eq!(s.current_step.as_deref(), Some("Done."));
    assert_eq!(s.subagents.len(), 1);
    let sub = &s.subagents[0];
    assert_eq!((sub.id.as_str(), sub.title.as_str(), sub.kind.as_deref()), ("a1", "Scan repo", Some("Explore")));
    assert_eq!(sub.status, AgentStatus::Done);
    assert_eq!(sub.started_at, T0_MS);
}

#[test]
fn missing_root_is_unavailable() {
    let provider = ClaudeProvider::new("/nonexistent/.claude".into());
    assert!(!provider.is_available());
}
