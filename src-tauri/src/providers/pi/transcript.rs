//! Folds a Pi session JSONL.

use crate::domain::{AgentStatus, TokenUsage};
use crate::shared::jsonl::LineFold;
use crate::shared::text::{step, tool_step};
use crate::shared::time::parse_rfc3339_ms;
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Role {
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Default)]
pub struct PiState {
    id: Option<String>,
    cwd: Option<String>,
    started_ms: Option<i64>,
    name: Option<String>,
    first_prompt: Option<String>,
    model: Option<String>,
    totals: TokenUsage,
    context_used: Option<u64>,
    last_role: Option<Role>,
    stop_reason: Option<String>,
    step: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PiSummary {
    pub id: Option<String>,
    pub cwd: Option<String>,
    pub started_ms: Option<i64>,
    pub title: Option<String>,
    pub model: Option<String>,
    pub tokens: TokenUsage,
    pub status: AgentStatus,
    pub step: Option<String>,
}

impl LineFold for PiState {
    fn apply(&mut self, line: &Value) {
        let text = |k: &str| line[k].as_str().map(str::to_owned);
        match line["type"].as_str().unwrap_or("") {
            "session" => {
                self.id = text("id");
                self.cwd = text("cwd");
                self.started_ms = line["timestamp"].as_str().and_then(parse_rfc3339_ms);
            }
            "model_change" => self.model = text("modelId").or(self.model.take()),
            "session_info" => self.name = text("name").or(self.name.take()),
            "message" => self.on_message(&line["message"]),
            _ => {}
        }
    }
}

impl PiState {
    fn on_message(&mut self, msg: &Value) {
        match msg["role"].as_str().unwrap_or("") {
            "user" => {
                self.last_role = Some(Role::User);
                if self.first_prompt.is_none() {
                    self.first_prompt = first_text(&msg["content"]).map(str::to_owned);
                }
            }
            "assistant" => self.on_assistant(msg),
            _ => self.last_role = Some(Role::Tool),
        }
    }

    fn on_assistant(&mut self, msg: &Value) {
        let u = &msg["usage"];
        let n = |k: &str| u[k].as_u64().unwrap_or(0);
        let turn = TokenUsage::new(n("input"), n("output"), n("cacheRead"), n("cacheWrite"));
        let t = self.totals;
        self.totals = TokenUsage::new(
            t.input + turn.input,
            t.output + turn.output,
            t.cache_read + turn.cache_read,
            t.cache_write + turn.cache_write,
        );
        let used = turn.input + turn.cache_read + turn.cache_write;
        if used > 0 {
            self.context_used = Some(used);
        }
        if let Some(model) = msg["model"].as_str() {
            self.model = Some(model.to_owned());
        }
        self.stop_reason = msg["stopReason"].as_str().map(str::to_owned);
        self.last_role = Some(Role::Assistant);
        if let Some(error) = msg["errorMessage"].as_str().and_then(step) {
            self.step = Some(error);
        }
        for block in msg["content"].as_array().into_iter().flatten() {
            match block["type"].as_str().unwrap_or("") {
                "text" => {
                    if let Some(text) = block["text"].as_str().and_then(step) {
                        self.step = Some(text);
                    }
                }
                "toolCall" => {
                    self.step = Some(tool_step(block["name"].as_str().unwrap_or("tool"), &block["arguments"]));
                }
                _ => {}
            }
        }
    }

    /// `toolUse`→running, `error`→error, `stop`/`aborted`/`length`→idle; a
    /// trailing user/tool-result message means the model is working.
    pub fn status(&self) -> AgentStatus {
        match self.last_role {
            None => AgentStatus::Idle,
            Some(Role::User | Role::Tool) => AgentStatus::Running,
            Some(Role::Assistant) => match self.stop_reason.as_deref() {
                Some("toolUse") => AgentStatus::Running,
                Some("error") => AgentStatus::Error,
                _ => AgentStatus::Idle,
            },
        }
    }

    pub fn summary(&self) -> PiSummary {
        PiSummary {
            id: self.id.clone(),
            cwd: self.cwd.clone(),
            started_ms: self.started_ms,
            title: self.name.clone().or_else(|| self.first_prompt.clone()),
            model: self.model.clone(),
            // Pi does not record the model's window size.
            tokens: self.totals.with_context(self.context_used, None),
            status: self.status(),
            step: self.step.clone(),
        }
    }
}

fn first_text(content: &Value) -> Option<&str> {
    match content {
        Value::String(s) => Some(s.as_str()),
        Value::Array(blocks) => blocks.iter().find_map(|b| b["text"].as_str()),
        _ => None,
    }
}
