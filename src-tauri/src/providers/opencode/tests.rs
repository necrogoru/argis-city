use super::message::{child_status, current_step, latest_turn, model_id, session_status, Outcome};
use super::OpenCodeProvider;
use crate::domain::{AgentStatus, ProgressSource};
use crate::providers::{AgentProvider, CollectContext};
use crate::system::ProcessInfo;
use rusqlite::{params, Connection};
use serde_json::json;
use std::fs;

/// Real OpenCode column names (subset of the live schema).
const SCHEMA: &str = "
CREATE TABLE session (id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL,
  directory text NOT NULL, title text NOT NULL, version text NOT NULL, time_created integer NOT NULL,
  time_updated integer NOT NULL, time_archived integer, agent text, model text,
  tokens_input integer DEFAULT 0 NOT NULL, tokens_output integer DEFAULT 0 NOT NULL,
  tokens_reasoning integer DEFAULT 0 NOT NULL, tokens_cache_read integer DEFAULT 0 NOT NULL,
  tokens_cache_write integer DEFAULT 0 NOT NULL);
CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL,
  time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE part (id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL,
  time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE todo (session_id text NOT NULL, content text NOT NULL, status text NOT NULL,
  priority text NOT NULL, position integer NOT NULL, time_created integer NOT NULL,
  time_updated integer NOT NULL, PRIMARY KEY(session_id, position));";

fn assistant(completed: bool, finish: &str) -> String {
    let time = if completed { json!({"created": 1, "completed": 2}) } else { json!({"created": 1}) };
    json!({"role": "assistant", "modelID": "gpt-6-luna", "finish": finish, "time": time,
        "tokens": {"input": 100, "output": 5, "reasoning": 0, "cache": {"read": 900, "write": 0}}})
    .to_string()
}

#[test]
fn turn_outcomes() {
    let running = latest_turn(&[assistant(false, "")]);
    assert_eq!((running.outcome, running.context_used), (Outcome::Working, Some(1000)));
    assert_eq!(latest_turn(&[assistant(true, "tool-calls")]).outcome, Outcome::Working);
    assert_eq!(session_status(&latest_turn(&[assistant(true, "stop")])), AgentStatus::Idle);
    let user = json!({"role": "user"}).to_string();
    let fresh = latest_turn(&[user, assistant(true, "stop")]);
    assert_eq!((fresh.outcome, fresh.model.as_deref()), (Outcome::Working, Some("gpt-6-luna")));
    let failed = json!({"role": "assistant", "error": {"name": "APIError"}, "time": {"completed": 1}}).to_string();
    assert_eq!(session_status(&latest_turn(&[failed])), AgentStatus::Error);
    let aborted = json!({"role": "assistant", "error": {"name": "MessageAbortedError"}}).to_string();
    assert_eq!(session_status(&latest_turn(std::slice::from_ref(&aborted))), AgentStatus::Idle);
    assert_eq!(child_status(&latest_turn(&[assistant(true, "stop")]), 0, 100_000), AgentStatus::Done);
    assert_eq!(child_status(&latest_turn(std::slice::from_ref(&aborted)), 90_000, 100_000), AgentStatus::Running);
    assert_eq!(child_status(&latest_turn(&[aborted]), 0, 100_000), AgentStatus::Idle);
}

#[test]
fn parts_and_model_helpers() {
    let tool =
        json!({"type": "tool", "tool": "bash", "state": {"status": "running", "input": {"command": "ls"}}}).to_string();
    let text = json!({"type": "text", "text": "Reading files"}).to_string();
    let finish = json!({"type": "step-finish"}).to_string();
    assert_eq!(current_step(&[finish.clone(), tool, text.clone()]).as_deref(), Some("bash: ls"));
    assert_eq!(current_step(&[finish, text]).as_deref(), Some("Reading files"));
    assert_eq!(model_id(Some(r#"{"id":"gpt-6-luna","providerID":"x"}"#)).as_deref(), Some("gpt-6-luna"));
    assert_eq!(model_id(None), None);
}

#[test]
fn provider_reads_sqlite_with_real_columns() {
    let root = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    let dir = work.path().to_string_lossy().to_string();
    let now = 10_000_000;
    let conn = Connection::open(root.path().join("opencode.db")).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    let insert = "INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created,
        time_updated, time_archived, agent, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_write)
        VALUES (?1, 'p', ?2, 's', ?3, ?4, '1', ?5, ?6, ?7, ?8, ?9, 10, 20, 30, 40)";
    let model = r#"{"id":"gpt-6-luna"}"#;
    conn.execute(
        insert,
        params!["root", None::<String>, dir, "Build API", now - 50_000, now - 1_000, None::<i64>, "build", model],
    )
    .unwrap();
    conn.execute(
        insert,
        params!["kid", "root", dir, "Review (@reviewer)", now - 40_000, now - 35_000, None::<i64>, "reviewer", model],
    )
    .unwrap();
    conn.execute(insert, params!["gone", None::<String>, dir, "Archived", 0, now, now, "build", model]).unwrap();
    conn.execute(
        insert,
        params!["old", None::<String>, "/elsewhere", "Old", 0, now - 900_000, None::<i64>, "build", model],
    )
    .unwrap();
    let msg = "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?3, ?4)";
    conn.execute(msg, params!["m1", "root", now - 2_000, assistant(false, "")]).unwrap();
    conn.execute(msg, params!["m2", "kid", now - 36_000, assistant(true, "stop")]).unwrap();
    let part = json!({"type": "text", "text": "Writing handlers"}).to_string();
    conn.execute("INSERT INTO part VALUES ('p1', 'm1', 'root', ?1, ?1, ?2)", params![now - 1_500, part]).unwrap();
    for (pos, status) in ["completed", "completed", "in_progress", "pending"].iter().enumerate() {
        conn.execute("INSERT INTO todo VALUES ('root', 'x', ?1, 'high', ?2, 0, 0)", params![status, pos as i64])
            .unwrap();
    }
    drop(conn);

    let provider = OpenCodeProvider::new(root.path().to_path_buf());
    let proc = ProcessInfo {
        pid: 9,
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
        ("opencode:root", "Build API", Some(9), AgentStatus::Running)
    );
    assert_eq!((s.model.as_deref(), s.tokens.total, s.tokens.context_used), (Some("gpt-6-luna"), 100, Some(1000)));
    assert_eq!((s.progress.source, s.progress.percent), (ProgressSource::Plan, Some(50.0)));
    assert_eq!(s.current_step.as_deref(), Some("Writing handlers"));
    assert_eq!(s.subagents.len(), 1);
    let kid = &s.subagents[0];
    assert_eq!((kid.kind.as_deref(), kid.status), (Some("reviewer"), AgentStatus::Done));
}

#[test]
fn missing_db_or_dir() {
    let root = tempfile::tempdir().unwrap();
    let provider = OpenCodeProvider::new(root.path().to_path_buf());
    assert!(provider.is_available());
    assert!(provider.collect(&CollectContext { processes: vec![], now_ms: 0 }).unwrap().is_empty());
    fs::remove_dir(root.path()).unwrap();
    assert!(!provider.is_available());
}
