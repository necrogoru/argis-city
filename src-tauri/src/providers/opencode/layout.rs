//! OpenCode keeps two storage layouts side by side in `opencode.db`: the
//! legacy `session` / `message` / `part` tables and the newer `session_v2` /
//! `session_message` tables (message content inline, role in a `type` column).

use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Legacy,
    V2,
}

impl Layout {
    /// Newest first: when a session id exists in both, V2 wins.
    pub const ALL: [Layout; 2] = [Layout::V2, Layout::Legacy];

    pub fn session_table(self) -> &'static str {
        match self {
            Layout::Legacy => "session",
            Layout::V2 => "session_v2",
        }
    }

    pub fn message_table(self) -> &'static str {
        match self {
            Layout::Legacy => "message",
            Layout::V2 => "session_message",
        }
    }

    /// Newest-first message query; both return `(role_or_null, data)`.
    pub fn messages_sql(self) -> &'static str {
        match self {
            Layout::Legacy => {
                "SELECT NULL, data FROM message WHERE session_id = ?1 ORDER BY time_created DESC, id DESC LIMIT ?2"
            }
            Layout::V2 => "SELECT type, data FROM session_message WHERE session_id = ?1 ORDER BY seq DESC LIMIT ?2",
        }
    }
}

/// Parses a message row into the legacy shape (`role` inside the JSON).
pub fn normalize_message(role: Option<String>, data: &str) -> Option<Value> {
    let mut value: Value = serde_json::from_str(data).ok()?;
    if let (Some(role), Some(obj)) = (role, value.as_object_mut()) {
        obj.entry("role").or_insert(Value::String(role));
    }
    Some(value)
}

/// V2 stores parts inline in `message.content`; flatten them newest-first.
pub fn inline_parts(messages: &[Value]) -> Vec<Value> {
    messages.iter().filter_map(|m| m["content"].as_array()).flat_map(|content| content.iter().rev().cloned()).collect()
}
