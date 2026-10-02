//! Folds a Claude Code transcript (`<sessionId>.jsonl` or a subagent's
//! `agent-<id>.jsonl`) into token totals, plan, status hints and a step.

use super::plan::PlanTracker;
use super::usage::{Usage, UsageLedger};
use crate::domain::{PlanCounts, TokenUsage};
use crate::shared::jsonl::LineFold;
use crate::shared::text::{step, tool_step};
use crate::shared::time::parse_rfc3339_ms;
use serde_json::Value;
use std::collections::HashMap;

/// Kind of the most recent user/assistant record.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
enum LastRecord {
    #[default]
    None,
    AssistantToolUse,
    AssistantOther,
    User,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingTool {
    pub name: String,
    pub started_ms: Option<i64>,
}

#[derive(Debug, Default)]
pub struct TranscriptState {
    usage: UsageLedger,
    model: Option<String>,
    one_m: bool,
    custom_title: Option<String>,
    agent_name: Option<String>,
    first_prompt: Option<String>,
    first_ts: Option<i64>,
    plan: PlanTracker,
    pending: HashMap<String, PendingTool>,
    last_tool_id: Option<String>,
    last_record: LastRecord,
    last_stop_reason: Option<String>,
    last_error: bool,
    step: Option<String>,
    permission_mode: Option<String>,
}

/// Owned per-poll view of a folded transcript.
#[derive(Debug, Clone, PartialEq)]
pub struct TranscriptSummary {
    pub tokens: TokenUsage,
    pub plan: Option<PlanCounts>,
    pub model: Option<String>,
    pub title: Option<String>,
    pub first_prompt: Option<String>,
    pub first_ts: Option<i64>,
    pub step: Option<String>,
    pub ended_turn: bool,
    pub last_error: bool,
    /// The last record is an assistant `tool_use` still waiting for its result.
    pub blocking_tool: Option<PendingTool>,
    pub bypass_permissions: bool,
}

impl LineFold for TranscriptState {
    fn apply(&mut self, line: &Value) {
        match line["type"].as_str().unwrap_or("") {
            "assistant" => self.on_assistant(line),
            "user" => self.on_user(line),
            "custom-title" => self.custom_title = line["customTitle"].as_str().map(str::to_owned),
            "agent-name" => self.agent_name = line["agentName"].as_str().map(str::to_owned),
            "permission-mode" => self.permission_mode = line["permissionMode"].as_str().map(str::to_owned),
            "cost-state" => {
                let keys = line["modelUsage"].as_object().into_iter().flat_map(|m| m.keys());
                self.one_m |= keys.into_iter().any(|k| k.contains("[1m]"));
            }
            _ => {}
        }
    }
}

impl TranscriptState {
    fn on_assistant(&mut self, line: &Value) {
        let msg = &line["message"];
        let ts = line["timestamp"].as_str().and_then(parse_rfc3339_ms);
        self.first_ts = self.first_ts.or(ts);
        self.last_error = line["isApiErrorMessage"].as_bool().unwrap_or(false);
        self.last_stop_reason = msg["stop_reason"].as_str().map(str::to_owned);
        let model = msg["model"].as_str().filter(|m| !m.starts_with('<'));
        if let Some(model) = model {
            self.model = Some(model.to_owned());
            if let Some(usage) = Usage::parse(&msg["usage"]) {
                self.usage.record(msg["id"].as_str(), usage);
            }
        }
        for block in msg["content"].as_array().into_iter().flatten() {
            match block["type"].as_str().unwrap_or("") {
                "text" => {
                    if let Some(text) = block["text"].as_str().and_then(step) {
                        self.step = Some(text);
                    }
                    self.last_record = LastRecord::AssistantOther;
                }
                "tool_use" => {
                    let name = block["name"].as_str().unwrap_or("tool");
                    let id = block["id"].as_str().unwrap_or_default().to_owned();
                    self.plan.on_tool_use(name, &block["input"]);
                    self.step = Some(tool_step(name, &block["input"]));
                    self.pending.insert(id.clone(), PendingTool { name: name.to_owned(), started_ms: ts });
                    self.last_tool_id = Some(id);
                    self.last_record = LastRecord::AssistantToolUse;
                }
                _ => self.last_record = LastRecord::AssistantOther,
            }
        }
    }

    fn on_user(&mut self, line: &Value) {
        let ts = line["timestamp"].as_str().and_then(parse_rfc3339_ms);
        self.first_ts = self.first_ts.or(ts);
        self.last_record = LastRecord::User;
        match &line["message"]["content"] {
            Value::String(text) => self.on_prompt(text),
            Value::Array(blocks) => {
                for block in blocks {
                    match block["type"].as_str().unwrap_or("") {
                        "tool_result" => {
                            self.pending.remove(block["tool_use_id"].as_str().unwrap_or_default());
                        }
                        "text" => self.on_prompt(block["text"].as_str().unwrap_or_default()),
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    /// A new prompt ends the previous turn: abandoned tool calls are moot.
    fn on_prompt(&mut self, text: &str) {
        self.pending.clear();
        if self.first_prompt.is_none() && !text.trim().is_empty() {
            self.first_prompt = Some(text.to_owned());
        }
    }

    pub fn summary(&self) -> TranscriptSummary {
        let one_m = self.one_m || self.model.as_deref().is_some_and(|m| m.contains("[1m]"));
        let model = self.model.as_ref().map(|m| match one_m && !m.contains("[1m]") {
            true => format!("{m}[1m]"),
            false => m.clone(),
        });
        let blocking = (self.last_record == LastRecord::AssistantToolUse)
            .then(|| self.last_tool_id.as_ref().and_then(|id| self.pending.get(id)).cloned())
            .flatten();
        TranscriptSummary {
            tokens: self.usage.tokens(self.model.is_some(), one_m),
            plan: self.plan.counts(),
            model,
            title: self.custom_title.clone().or_else(|| self.agent_name.clone()),
            first_prompt: self.first_prompt.clone(),
            first_ts: self.first_ts,
            step: self.step.clone(),
            ended_turn: self.last_stop_reason.as_deref() == Some("end_turn") && self.pending.is_empty(),
            last_error: self.last_error,
            blocking_tool: blocking,
            bypass_permissions: self.permission_mode.as_deref() == Some("bypassPermissions"),
        }
    }
}
