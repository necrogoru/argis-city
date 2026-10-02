use super::rollout::RolloutState;
use super::CodexProvider;
use crate::domain::{AgentStatus, PlanCounts, ProgressSource};
use crate::providers::{AgentProvider, CollectContext};
use crate::shared::jsonl::LineFold;
use crate::system::clock::system_time_ms;
use crate::system::ProcessInfo;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::time::SystemTime;

fn event(payload: Value) -> Value {
    json!({"type": "event_msg", "payload": payload})
}

fn item(payload: Value) -> Value {
    json!({"type": "response_item", "payload": payload})
}

fn token_count() -> Value {
    event(json!({"type": "token_count", "info": {
        "total_token_usage": {"input_tokens": 1000, "cached_input_tokens": 600, "cache_write_input_tokens": 0, "output_tokens": 50, "total_tokens": 1050},
        "last_token_usage": {"input_tokens": 400, "cached_input_tokens": 300, "output_tokens": 10},
        "model_context_window": 258400}}))
}

fn plan_call() -> Value {
    let args = json!({"plan": [{"step": "a", "status": "completed"}, {"step": "b", "status": "in_progress"}]});
    item(json!({"type": "function_call", "name": "update_plan", "arguments": args.to_string(), "call_id": "c1"}))
}

fn fold(lines: &[Value]) -> RolloutState {
    let mut s = RolloutState::default();
    lines.iter().for_each(|l| s.apply(l));
    s
}

#[test]
fn token_count_maps_totals_and_context() {
    let s = fold(&[event(json!({"type": "token_count", "info": null})), token_count()]).summary();
    let t = s.tokens.unwrap();
    assert_eq!((t.input, t.cache_read, t.output, t.total), (400, 600, 50, 1050));
    assert_eq!((t.context_used, t.context_window), (Some(400), Some(258400)));
}

#[test]
fn plan_comes_from_latest_update_plan() {
    let s = fold(&[plan_call()]).summary();
    assert_eq!(s.plan, Some(PlanCounts { completed: 1, total: 2 }));
    assert!(s.step.as_deref().is_some_and(|st| st.starts_with("update_plan")));
    let replaced = fold(&[
        plan_call(),
        item(json!({"type": "custom_tool_call", "name": "update_plan",
        "input": "{\"plan\":[{\"status\":\"completed\"}]}"})),
    ]);
    assert_eq!(replaced.summary().plan, Some(PlanCounts { completed: 1, total: 1 }));
}

#[test]
fn status_follows_task_lifecycle() {
    let started = event(json!({"type": "task_started", "model_context_window": 1000}));
    assert_eq!(fold(std::slice::from_ref(&started)).status(), AgentStatus::Running);
    let approval = event(json!({"type": "exec_approval_request", "call_id": "x"}));
    assert_eq!(fold(&[started.clone(), approval.clone()]).status(), AgentStatus::AwaitingApproval);
    let begin = event(json!({"type": "exec_command_begin"}));
    assert_eq!(fold(&[started.clone(), approval, token_count(), begin]).status(), AgentStatus::Running);
    let done = event(json!({"type": "task_complete", "last_agent_message": "All set."}));
    let s = fold(&[started.clone(), done]);
    assert_eq!((s.status(), s.summary().step.as_deref()), (AgentStatus::Idle, Some("All set.")));
    let aborted = event(json!({"type": "turn_aborted", "reason": "interrupted"}));
    assert_eq!(fold(&[started.clone(), aborted]).status(), AgentStatus::Idle);
    let err = event(json!({"type": "error", "message": "boom"}));
    let complete = event(json!({"type": "task_complete"}));
    assert_eq!(fold(&[started.clone(), err, complete]).status(), AgentStatus::Error);
    let ask = item(json!({"type": "function_call", "name": "request_user_input", "arguments": "{}", "call_id": "q"}));
    assert_eq!(fold(&[started.clone(), ask.clone()]).status(), AgentStatus::AwaitingApproval);
    let answer = item(json!({"type": "function_call_output", "call_id": "q", "output": "ok"}));
    assert_eq!(fold(&[started, ask, answer]).status(), AgentStatus::Running);
}

#[test]
fn step_prefers_latest_message_or_tool() {
    let msg = item(
        json!({"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "Looking at files"}]}),
    );
    let call =
        item(json!({"type": "function_call", "name": "exec_command", "arguments": "{\"cmd\":\"ls\"}", "call_id": "c"}));
    assert_eq!(fold(std::slice::from_ref(&msg)).summary().step.as_deref(), Some("Looking at files"));
    assert_eq!(fold(&[msg, call]).summary().step.as_deref(), Some("exec_command: ls"));
}

const SCHEMA: &str = "
CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL, tokens_used INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0, agent_nickname TEXT, agent_role TEXT, model TEXT,
  created_at_ms INTEGER, updated_at_ms INTEGER, name TEXT);
CREATE TABLE thread_spawn_edges (parent_thread_id TEXT NOT NULL, child_thread_id TEXT NOT NULL PRIMARY KEY, status TEXT NOT NULL);";

fn write_rollout(path: &Path, lines: &[Value]) {
    fs::write(path, lines.iter().map(|l| format!("{l}\n")).collect::<String>()).unwrap();
}

#[test]
fn provider_reads_index_rollouts_and_children() {
    let home = tempfile::tempdir().unwrap();
    let root = home.path().join(".codex");
    let work = home.path().join("work");
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(&work).unwrap();
    let now = system_time_ms(SystemTime::now());
    let (parent_path, child_path, old_path) = (root.join("p.jsonl"), root.join("c.jsonl"), root.join("o.jsonl"));
    write_rollout(&parent_path, &[event(json!({"type": "task_started"})), token_count(), plan_call()]);
    write_rollout(&child_path, &[event(json!({"type": "task_started"})), event(json!({"type": "task_complete"}))]);
    write_rollout(&old_path, &[]);
    let conn = Connection::open(root.join("state_5.sqlite")).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    let insert = "INSERT INTO threads (id, rollout_path, created_at, updated_at, cwd, title, tokens_used, model, created_at_ms, updated_at_ms, agent_nickname, agent_role) VALUES (?1, ?2, 0, 0, ?3, ?4, 7, 'gpt-x', ?5, ?6, ?7, ?8)";
    let cwd = work.to_string_lossy().to_string();
    let p = |s: &Path| s.to_string_lossy().to_string();
    conn.execute(
        insert,
        rusqlite::params![
            "parent",
            p(&parent_path),
            cwd,
            "Fix the bug",
            now - 5000,
            now - 1000,
            None::<String>,
            None::<String>
        ],
    )
    .unwrap();
    conn.execute(
        insert,
        rusqlite::params!["child", p(&child_path), cwd, "sub", now - 4000, now - 2000, "Einstein", "explorer"],
    )
    .unwrap();
    conn.execute(
        insert,
        rusqlite::params![
            "stale",
            p(&old_path),
            "/elsewhere",
            "old",
            now - 9_000_000,
            now - 9_000_000,
            None::<String>,
            None::<String>
        ],
    )
    .unwrap();
    conn.execute("INSERT INTO thread_spawn_edges VALUES ('parent', 'child', 'closed')", []).unwrap();
    drop(conn);

    let proc = ProcessInfo {
        pid: 77,
        parent_pid: None,
        name: "codex".into(),
        cmd: vec![],
        cwd: Some(work.clone()),
        started_at_ms: now - 10_000,
    };
    let provider = CodexProvider::new(root);
    let sessions = provider.collect(&CollectContext { processes: vec![proc], now_ms: now }).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(
        (s.id.as_str(), s.title.as_str(), s.pid, s.status),
        ("codex:parent", "Fix the bug", Some(77), AgentStatus::Running)
    );
    assert_eq!((s.model.as_deref(), s.tokens.total), (Some("gpt-x"), 1050));
    assert_eq!((s.progress.source, s.progress.percent), (ProgressSource::Plan, Some(50.0)));
    assert_eq!(s.subagents.len(), 1);
    let sub = &s.subagents[0];
    assert_eq!(
        (sub.title.as_str(), sub.kind.as_deref(), sub.status),
        ("Einstein", Some("explorer"), AgentStatus::Done)
    );
    assert_eq!(sub.tokens.total, 7);
}

#[test]
fn missing_index_yields_no_sessions() {
    let home = tempfile::tempdir().unwrap();
    let provider = CodexProvider::new(home.path().to_path_buf());
    assert!(provider.is_available());
    let ctx = CollectContext { processes: vec![], now_ms: 0 };
    assert!(provider.collect(&ctx).unwrap().is_empty());
}
