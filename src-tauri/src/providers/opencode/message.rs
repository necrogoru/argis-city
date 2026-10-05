//! Interprets OpenCode messages and parts (legacy shape: `role` in the JSON;
//! V2 rows are normalized to it by `layout::normalize_message`).

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
    /// e.g. `github-copilot` — keys the model catalog lookup.
    pub model_provider: Option<String>,
}

/// Reads the newest-first messages of a session.
pub fn latest_turn(messages: &[Value]) -> Turn {
    let outcome = messages.first().map_or(Outcome::Finished, outcome_of);
    let assistant = messages.iter().find(|m| m["role"] == "assistant");
    // A message still streaming has no usage yet: take the newest that does.
    let context_used = messages.iter().filter(|m| m["role"] == "assistant").find_map(context_of);
    let text =
        |m: &Value, flat: &str, nested: &str| m[flat].as_str().or(m["model"][nested].as_str()).map(str::to_owned);
    Turn {
        outcome,
        context_used,
        model: assistant.and_then(|m| text(m, "modelID", "id")),
        model_provider: assistant.and_then(|m| text(m, "providerID", "providerID")),
    }
}

fn context_of(message: &Value) -> Option<u64> {
    let t = &message["tokens"];
    let n = |v: &Value| v.as_u64().unwrap_or(0);
    let used = n(&t["input"]) + n(&t["cache"]["read"]) + n(&t["cache"]["write"]);
    (used > 0).then_some(used)
}

fn outcome_of(message: &Value) -> Outcome {
    match message["role"].as_str() {
        Some("assistant") => assistant_outcome(message),
        // V2 writes an explicit `idle` row when a turn ends.
        Some("idle") => match message["outcome"].as_str() {
            Some("aborted" | "cancelled" | "interrupted") => Outcome::Aborted,
            Some("failed" | "error") => Outcome::Failed,
            _ => Outcome::Finished,
        },
        _ => Outcome::Working,
    }
}

fn assistant_outcome(message: &Value) -> Outcome {
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

/// The newest tool call is a `question` still waiting for the user's answer.
pub fn awaiting_user(parts: &[Value]) -> bool {
    parts.iter().find(|p| p["type"] == "tool").is_some_and(|p| {
        tool_name(p) == Some("question") && !matches!(p["state"]["status"].as_str(), Some("completed" | "error"))
    })
}

pub fn session_status(turn: &Turn, awaiting: bool) -> AgentStatus {
    match turn.outcome {
        Outcome::Working if awaiting => AgentStatus::AwaitingApproval,
        Outcome::Working => AgentStatus::Running,
        Outcome::Finished | Outcome::Aborted => AgentStatus::Idle,
        Outcome::Failed => AgentStatus::Error,
    }
}

/// done (completed) → awaiting → running (working or written < 30 s ago) → error → idle.
pub fn child_status(turn: &Turn, awaiting: bool, updated_ms: i64, now_ms: i64) -> AgentStatus {
    match turn.outcome {
        Outcome::Finished => AgentStatus::Done,
        Outcome::Working if awaiting => AgentStatus::AwaitingApproval,
        Outcome::Working => AgentStatus::Running,
        _ if now_ms - updated_ms < RUNNING_WINDOW_MS => AgentStatus::Running,
        Outcome::Failed => AgentStatus::Error,
        Outcome::Aborted => AgentStatus::Idle,
    }
}

/// Latest text or tool part (newest-first) as a step.
pub fn current_step(parts: &[Value]) -> Option<String> {
    parts.iter().find_map(|p| match p["type"].as_str()? {
        "text" => p["text"].as_str().and_then(step),
        "tool" => Some(tool_step(tool_name(p).unwrap_or("tool"), &p["state"]["input"])),
        _ => None,
    })
}

/// Legacy parts name the tool `tool`; V2 inline parts call it `name`.
fn tool_name(part: &Value) -> Option<&str> {
    part["tool"].as_str().or(part["name"].as_str())
}

/// `{"id": "…", "providerID": "…"}` model JSON → (provider, id); a plain
/// string is taken as the id.
pub fn model_ref(raw: Option<&str>) -> Option<(Option<String>, String)> {
    let raw = raw?.trim();
    match serde_json::from_str::<Value>(raw) {
        Ok(v) => {
            let id = v["id"].as_str().or(v["modelID"].as_str())?.to_owned();
            Some((v["providerID"].as_str().map(str::to_owned), id))
        }
        Err(_) => (!raw.is_empty()).then(|| (None, raw.to_owned())),
    }
}
