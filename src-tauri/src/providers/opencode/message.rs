//! Interprets OpenCode `message.data` / `part.data` JSON.

use crate::domain::AgentStatus;
use crate::providers::RUNNING_WINDOW_MS;
use crate::shared::text::{step, tool_step};
use serde_json::Value;

/// How the latest turn stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// Assistant still generating, looping on tool calls, or a fresh prompt.
    Working,
    Finished,
    Aborted,
    Failed,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Turn {
    pub outcome: Outcome,
    /// input + cache read/write of the latest assistant message.
    pub context_used: Option<u64>,
    pub model: Option<String>,
}

/// Reads the newest-first `message.data` rows of a session.
pub fn latest_turn(messages: &[String]) -> Turn {
    let parsed: Vec<Value> = messages.iter().filter_map(|m| serde_json::from_str(m).ok()).collect();
    let outcome = parsed.first().map_or(Outcome::Finished, outcome_of);
    let assistant = parsed.iter().find(|m| m["role"] == "assistant");
    let context_used = assistant.and_then(|m| {
        let t = &m["tokens"];
        let n = |v: &Value| v.as_u64().unwrap_or(0);
        let used = n(&t["input"]) + n(&t["cache"]["read"]) + n(&t["cache"]["write"]);
        (used > 0).then_some(used)
    });
    let model = assistant.and_then(|m| m["modelID"].as_str()).map(str::to_owned);
    Turn { outcome, context_used, model }
}

fn outcome_of(message: &Value) -> Outcome {
    if message["role"] != "assistant" {
        return Outcome::Working;
    }
    if message["error"].is_object() {
        return match message["error"]["name"].as_str() {
            Some("MessageAbortedError") => Outcome::Aborted,
            _ => Outcome::Failed,
        };
    }
    let completed = message["time"]["completed"].is_number();
    if !completed || message["finish"] == "tool-calls" {
        Outcome::Working
    } else {
        Outcome::Finished
    }
}

pub fn session_status(turn: &Turn) -> AgentStatus {
    match turn.outcome {
        Outcome::Working => AgentStatus::Running,
        Outcome::Finished | Outcome::Aborted => AgentStatus::Idle,
        Outcome::Failed => AgentStatus::Error,
    }
}

/// done (completed) → running (working or written < 30 s ago) → error → idle.
pub fn child_status(turn: &Turn, updated_ms: i64, now_ms: i64) -> AgentStatus {
    match turn.outcome {
        Outcome::Finished => AgentStatus::Done,
        Outcome::Working => AgentStatus::Running,
        _ if now_ms - updated_ms < RUNNING_WINDOW_MS => AgentStatus::Running,
        Outcome::Failed => AgentStatus::Error,
        Outcome::Aborted => AgentStatus::Idle,
    }
}

/// Latest text or tool part (newest-first rows) as a step.
pub fn current_step(parts: &[String]) -> Option<String> {
    parts.iter().filter_map(|p| serde_json::from_str::<Value>(p).ok()).find_map(|p| match p["type"].as_str()? {
        "text" => p["text"].as_str().and_then(step),
        "tool" => Some(tool_step(p["tool"].as_str().unwrap_or("tool"), &p["state"]["input"])),
        _ => None,
    })
}

/// `{"id": "…"}` model JSON → id; a plain string is taken as-is.
pub fn model_id(raw: Option<&str>) -> Option<String> {
    let raw = raw?.trim();
    match serde_json::from_str::<Value>(raw) {
        Ok(v) => v["id"].as_str().or(v["modelID"].as_str()).map(str::to_owned),
        Err(_) => (!raw.is_empty()).then(|| raw.to_owned()),
    }
}
