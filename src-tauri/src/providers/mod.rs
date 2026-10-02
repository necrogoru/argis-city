//! One provider per coding-agent tool. Each turns the tool's on-disk state
//! plus the live process list into `AgentSession`s.

pub mod claude;
pub mod codex;
pub mod opencode;
pub mod pi;

use crate::domain::{AgentSession, ProviderId};
use crate::system::ProcessInfo;

/// A subagent written to within this window is considered running.
pub const RUNNING_WINDOW_MS: i64 = 30_000;
/// A pending tool call untouched this long is considered blocked on approval.
pub const APPROVAL_STALE_MS: i64 = 8_000;
/// DB-indexed tools: rows updated within this window are liveness candidates
/// even without a matching process.
pub const CANDIDATE_WINDOW_MS: i64 = 10 * 60 * 1000;

/// Per-poll inputs shared by all providers.
pub struct CollectContext {
    pub processes: Vec<ProcessInfo>,
    pub now_ms: i64,
}

pub trait AgentProvider: Send + Sync {
    fn id(&self) -> ProviderId;
    /// The tool's data directory exists on this machine.
    fn is_available(&self) -> bool;
    /// Live sessions right now. Errors are reported per provider.
    fn collect(&self, ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>>;
}

/// Oldest `updated_at` worth querying: recent rows, plus anything a live
/// process may own.
pub(crate) fn candidate_since(now_ms: i64, earliest_process_start: Option<i64>) -> i64 {
    let recent = now_ms - CANDIDATE_WINDOW_MS;
    earliest_process_start.map_or(recent, |start| start.min(recent))
}
