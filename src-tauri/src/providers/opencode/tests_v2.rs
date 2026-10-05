//! OpenCode's V2 layout (`session_v2` + `session_message`, content inline).

use super::layout::{inline_parts, normalize_message};
use super::message::{awaiting_user, latest_turn, session_status};
use super::OpenCodeProvider;
use crate::domain::AgentStatus;
use crate::providers::{AgentProvider, CollectContext};
use crate::system::ProcessInfo;
use rusqlite::{params, Connection};
use serde_json::{json, Value};

/// Real column names (subset of the live schema), plus an empty legacy table.
const SCHEMA: &str = "
CREATE TABLE session_v2 (id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL,
  directory text NOT NULL, title text, version text NOT NULL, agent text, model text,
  tokens_input integer DEFAULT 0 NOT NULL, tokens_output integer DEFAULT 0 NOT NULL,
  tokens_reasoning integer DEFAULT 0 NOT NULL, tokens_cache_read integer DEFAULT 0 NOT NULL,
  tokens_cache_write integer DEFAULT 0 NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL,
  time_archived integer, time_idle integer, idle_outcome text);
CREATE TABLE session_message (id text PRIMARY KEY, session_id text NOT NULL, type text NOT NULL,
  seq integer NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE session (id text PRIMARY KEY, parent_id text, directory text NOT NULL, title text NOT NULL,
  time_created integer NOT NULL, time_updated integer NOT NULL, time_archived integer);
CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL,
  time_updated integer NOT NULL, data text NOT NULL);";

fn tool(name: &str, status: &str, input: Value) -> Value {
    json!({"type": "tool", "id": "call_1", "name": name, "state": {"status": status, "input": input}})
}

fn assistant(content: Vec<Value>, finish: &str) -> Value {
    json!({"time": {"created": 1, "completed": 2}, "model": {"id": "gpt-6-luna"}, "finish": finish,
        "tokens": {"input": 168, "output": 260, "reasoning": 10, "cache": {"read": 3000, "write": 0}},
        "content": content})
}

fn normalized(role: &str, data: &Value) -> Value {
    normalize_message(Some(role.into()), &data.to_string()).unwrap()
}

#[test]
fn idle_row_ends_the_turn_and_question_blocks_it() {
    let idle = normalized("idle", &json!({"time": {"created": 3}, "outcome": "succeeded"}));
    let working = normalized("assistant", &assistant(vec![], "tool-calls"));
    assert_eq!(session_status(&latest_turn(&[idle, working.clone()]), false), AgentStatus::Idle);

    let turn = latest_turn(std::slice::from_ref(&working));
    assert_eq!((turn.model.as_deref(), turn.context_used), (Some("gpt-6-luna"), Some(3168)));

    let asking = normalized("assistant", &assistant(vec![tool("question", "running", json!({}))], "tool-calls"));
    let parts = inline_parts(std::slice::from_ref(&asking));
    assert!(awaiting_user(&parts));
    assert_eq!(session_status(&latest_turn(&[asking]), true), AgentStatus::AwaitingApproval);
    assert!(!awaiting_user(&[tool("question", "completed", json!({}))]));
    assert!(!awaiting_user(&[tool("shell", "running", json!({}))]));
}

#[test]
fn provider_reads_v2_sessions_and_children() {
    let root = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    let dir = work.path().to_string_lossy().to_string();
    let now = 10_000_000;
    let conn = Connection::open(root.path().join("opencode.db")).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    let insert = "INSERT INTO session_v2 (id, project_id, parent_id, slug, directory, title, version, agent, model,
        tokens_input, tokens_output, tokens_cache_read, tokens_cache_write, time_created, time_updated)
        VALUES (?1, 'p', ?2, 's', ?3, ?4, '1', 'build', '{\"id\":\"gpt-6-luna\"}', 10, 20, 30, 40, ?5, ?6)";
    conn.execute(insert, params!["ses_root", None::<String>, dir, "Plugin feature", now - 50_000, now - 1_000])
        .unwrap();
    conn.execute(insert, params!["ses_kid", "ses_root", dir, "Explore (@explore)", now - 40_000, now - 35_000])
        .unwrap();
    let msg = "INSERT INTO session_message VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)";
    let done = assistant(vec![json!({"type": "text", "text": "Explored"})], "stop");
    conn.execute(msg, params!["m0", "ses_kid", "assistant", 1, done.to_string()]).unwrap();
    conn.execute(msg, params!["m1", "ses_root", "user", 1, json!({"text": "go"}).to_string()]).unwrap();
    let busy = assistant(
        vec![json!({"type": "text", "text": "Patching"}), tool("shell", "running", json!({"command": "ls"}))],
        "tool-calls",
    );
    conn.execute(msg, params!["m2", "ses_root", "assistant", 2, busy.to_string()]).unwrap();
    drop(conn);

    let provider = OpenCodeProvider::new(root.path().to_path_buf());
    let proc = ProcessInfo {
        pid: 7,
        parent_pid: None,
        name: "opencode".into(),
        cmd: vec![],
        cwd: Some(work.path().to_path_buf()),
        started_at_ms: now - 60_000,
    };
    let sessions = provider.collect(&CollectContext { processes: vec![proc], now_ms: now }).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(
        (s.id.as_str(), s.title.as_str(), s.pid, s.status),
        ("opencode:ses_root", "Plugin feature", Some(7), AgentStatus::Running)
    );
    assert_eq!((s.model.as_deref(), s.tokens.total), (Some("gpt-6-luna"), 100));
    assert_eq!(s.current_step.as_deref(), Some("shell: ls"));
    assert_eq!(s.subagents.len(), 1);
    assert_eq!((s.subagents[0].id.as_str(), s.subagents[0].status), ("ses_kid", AgentStatus::Done));
}
