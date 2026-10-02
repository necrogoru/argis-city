//! Folds a Codex rollout JSONL (`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`).

use crate::domain::{AgentStatus, PlanCounts, TokenUsage};
use crate::shared::jsonl::LineFold;
use crate::shared::text::{step, tool_step};
use serde_json::Value;

#[derive(Debug, Default)]
pub struct RolloutState {
    totals: Option<TokenUsage>,
    context_used: Option<u64>,
    window: Option<u64>,
    model: Option<String>,
    turn_open: bool,
    errored: bool,
    approval_pending: bool,
    question_call: Option<String>,
    plan: Option<PlanCounts>,
    step: Option<String>,
}

/// Owned per-poll view of a folded rollout.
#[derive(Debug, Clone, PartialEq)]
pub struct RolloutSummary {
    /// `None` until a `token_count` event with usage has been seen.
    pub tokens: Option<TokenUsage>,
    pub model: Option<String>,
    pub status: AgentStatus,
    pub plan: Option<PlanCounts>,
    pub step: Option<String>,
}

impl LineFold for RolloutState {
    fn apply(&mut self, line: &Value) {
        let payload = &line["payload"];
        match line["type"].as_str().unwrap_or("") {
            "event_msg" => self.on_event(payload),
            "response_item" => self.on_item(payload),
            "turn_context" => {
                if let Some(model) = payload["model"].as_str() {
                    self.model = Some(model.to_owned());
                }
            }
            _ => {}
        }
    }
}

impl RolloutState {
    fn on_event(&mut self, p: &Value) {
        let kind = p["type"].as_str().unwrap_or("");
        match kind {
            "token_count" => return self.on_token_count(&p["info"]),
            "task_started" => {
                self.turn_open = true;
                self.errored = false;
                self.window = p["model_context_window"].as_u64().or(self.window);
            }
            "task_complete" | "turn_aborted" => {
                self.turn_open = false;
                self.question_call = None;
                if let Some(text) = p["last_agent_message"].as_str().and_then(step) {
                    self.step = Some(text);
                }
            }
            "error" | "stream_error" => self.errored = true,
            "agent_message" => self.set_text(p["message"].as_str()),
            "item_completed" if p["item"]["type"] == "AgentMessage" => {
                self.set_text(first_text(&p["item"]["content"]));
            }
            _ => {}
        }
        // Any later event means a pending approval was answered.
        self.approval_pending = kind.ends_with("_approval_request");
    }

    fn on_token_count(&mut self, info: &Value) {
        let total = &info["total_token_usage"];
        if !total.is_object() {
            return;
        }
        let n = |v: &Value, k: &str| v[k].as_u64().unwrap_or(0);
        let cached = n(total, "cached_input_tokens");
        // OpenAI's input_tokens already include the cached part.
        let input = n(total, "input_tokens").saturating_sub(cached);
        self.totals =
            Some(TokenUsage::new(input, n(total, "output_tokens"), cached, n(total, "cache_write_input_tokens")));
        self.context_used = info["last_token_usage"]["input_tokens"].as_u64().or(self.context_used);
        self.window = info["model_context_window"].as_u64().or(self.window);
    }

    fn on_item(&mut self, p: &Value) {
        match p["type"].as_str().unwrap_or("") {
            "message" if p["role"] == "assistant" => self.set_text(first_text(&p["content"])),
            "function_call" | "custom_tool_call" => {
                let name = p["name"].as_str().unwrap_or("tool");
                let input = if p["arguments"].is_null() { &p["input"] } else { &p["arguments"] };
                if name == "update_plan" {
                    self.plan = parse_plan(input).or(self.plan);
                } else if name == "request_user_input" {
                    self.question_call = p["call_id"].as_str().map(str::to_owned);
                }
                self.step = Some(tool_step(name, input));
            }
            "function_call_output" | "custom_tool_call_output"
                if self.question_call.as_deref().is_some_and(|c| p["call_id"] == c) =>
            {
                self.question_call = None;
            }
            _ => {}
        }
    }

    fn set_text(&mut self, text: Option<&str>) {
        if let Some(text) = text.and_then(step) {
            self.step = Some(text);
        }
    }

    /// pending approval/question → awaitingApproval; open turn → running;
    /// failed last turn → error; otherwise idle.
    pub fn status(&self) -> AgentStatus {
        if self.turn_open && (self.approval_pending || self.question_call.is_some()) {
            AgentStatus::AwaitingApproval
        } else if self.turn_open {
            AgentStatus::Running
        } else if self.errored {
            AgentStatus::Error
        } else {
            AgentStatus::Idle
        }
    }

    pub fn summary(&self) -> RolloutSummary {
        RolloutSummary {
            tokens: self.totals.map(|t| t.with_context(self.context_used, self.window)),
            model: self.model.clone(),
            status: self.status(),
            plan: self.plan,
            step: self.step.clone(),
        }
    }
}

/// `{"plan":[{"step","status"}]}`, given as an object or a JSON string.
fn parse_plan(input: &Value) -> Option<PlanCounts> {
    let parsed;
    let args = match input {
        Value::String(s) => {
            parsed = serde_json::from_str::<Value>(s).ok()?;
            &parsed
        }
        other => other,
    };
    let items = args["plan"].as_array()?;
    Some(PlanCounts::from_statuses(items.iter().map(|i| i["status"].as_str().unwrap_or("pending"))))
}

/// Text of the first `text`/`output_text`/`Text` content block.
fn first_text(content: &Value) -> Option<&str> {
    content.as_array()?.iter().find_map(|c| c["text"].as_str().filter(|t| !t.trim().is_empty()))
}
