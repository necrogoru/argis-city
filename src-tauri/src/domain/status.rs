use serde::Serialize;

/// What an agent is doing right now.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentStatus {
    /// Working on a turn.
    Running,
    /// Waiting for the user's next prompt.
    Idle,
    /// Blocked on a permission prompt or a question.
    AwaitingApproval,
    /// Finished (subagents).
    Done,
    /// The last turn failed.
    Error,
}
