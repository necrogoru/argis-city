//! Status decisions for Claude sessions and subagents.

use super::transcript::TranscriptSummary;
use crate::domain::AgentStatus;
use crate::providers::{APPROVAL_STALE_MS, RUNNING_WINDOW_MS};
use crate::shared::liveness::has_child_since;
use crate::system::ProcessInfo;

/// Inputs shared by every status decision in one poll.
pub struct StatusEnv<'a> {
    pub now_ms: i64,
    pub pid: u32,
    pub processes: &'a [ProcessInfo],
}

#[derive(Debug, PartialEq, Eq)]
enum ToolState {
    None,
    Executing,
    Blocked,
}

/// Registry status refined by the transcript: a busy session stuck on an
/// unanswered tool call is awaiting approval; an idle one whose last reply
/// was an API error is in error.
pub fn session_status(registry: AgentStatus, s: &TranscriptSummary, modified_ms: i64, env: &StatusEnv) -> AgentStatus {
    match registry {
        AgentStatus::Running if tool_state(s, modified_ms, env) == ToolState::Blocked => AgentStatus::AwaitingApproval,
        AgentStatus::Idle if s.last_error => AgentStatus::Error,
        other => other,
    }
}

/// done (ended its turn) → running (written < 30 s ago or executing a tool)
/// → awaitingApproval (stale pending tool while the parent is busy) → idle.
pub fn subagent_status(s: &TranscriptSummary, modified_ms: i64, parent: AgentStatus, env: &StatusEnv) -> AgentStatus {
    if s.ended_turn {
        return AgentStatus::Done;
    }
    if env.now_ms - modified_ms < RUNNING_WINDOW_MS {
        return AgentStatus::Running;
    }
    let parent_busy = matches!(parent, AgentStatus::Running | AgentStatus::AwaitingApproval);
    match tool_state(s, modified_ms, env) {
        ToolState::Blocked if parent_busy => AgentStatus::AwaitingApproval,
        ToolState::Executing if parent_busy => AgentStatus::Running,
        _ if s.last_error => AgentStatus::Error,
        _ => AgentStatus::Idle,
    }
}

/// A pending tool call is *blocked* when the file has been quiet ≥ 8 s and
/// nothing suggests the tool is actually executing.
fn tool_state(s: &TranscriptSummary, modified_ms: i64, env: &StatusEnv) -> ToolState {
    let Some(tool) = &s.blocking_tool else { return ToolState::None };
    if env.now_ms - modified_ms < APPROVAL_STALE_MS {
        return ToolState::Executing;
    }
    let blocked = match tool.name.as_str() {
        // These always wait for the user.
        "AskUserQuestion" | "ExitPlanMode" => true,
        // A foreground subagent keeps the call open while it works.
        "Agent" | "Task" => false,
        // Tools are auto-approved in this mode.
        _ if s.bypass_permissions => false,
        // A child process spawned after the call means it is running.
        _ => !tool.started_ms.is_some_and(|ts| has_child_since(env.processes, env.pid, ts)),
    };
    if blocked {
        ToolState::Blocked
    } else {
        ToolState::Executing
    }
}
