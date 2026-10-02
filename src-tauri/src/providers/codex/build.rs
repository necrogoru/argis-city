//! Maps Codex threads (+ folded rollouts) to wire types.

use super::index::ThreadRow;
use super::modified_ms;
use super::rollout::{RolloutState, RolloutSummary};
use crate::domain::{AgentSession, AgentStatus, Progress, ProviderId, SubAgent, TokenUsage};
use crate::providers::RUNNING_WINDOW_MS;
use crate::shared::jsonl::JsonlTailCache;
use crate::shared::text::title_or_dir;

type Cache = JsonlTailCache<RolloutState>;

/// Folded rollout (if readable) and the rollout's mtime.
fn fold(thread: &ThreadRow, cache: &mut Cache) -> (Option<RolloutSummary>, i64) {
    match cache.read_with(&thread.rollout_path, |s, m| (s.summary(), m.modified_ms)) {
        Ok((summary, modified)) => (Some(summary), modified),
        Err(_) => (None, thread.updated_at_ms),
    }
}

/// Rollout totals when present, else the index's `tokens_used`.
fn tokens(thread: &ThreadRow, summary: Option<&RolloutSummary>) -> TokenUsage {
    summary.and_then(|s| s.tokens).unwrap_or_else(|| TokenUsage::new(thread.tokens_used, 0, 0, 0))
}

pub fn session(
    thread: &ThreadRow,
    pid: Option<u32>,
    children: &[(String, ThreadRow)],
    now_ms: i64,
    cache: &mut Cache,
) -> AgentSession {
    let (summary, modified) = fold(thread, cache);
    let status = summary.as_ref().map_or(AgentStatus::Idle, |s| s.status);
    let tokens = tokens(thread, summary.as_ref());
    let cwd = thread.cwd.to_string_lossy().into_owned();
    let mut subagents: Vec<SubAgent> =
        children.iter().map(|(edge, child)| subagent(edge, child, now_ms, cache)).collect();
    subagents.sort_by_key(|s| s.started_at);
    AgentSession {
        id: ProviderId::Codex.session_id(&thread.id),
        provider: ProviderId::Codex,
        title: title_or_dir([thread.name.as_deref(), Some(thread.title.as_str())], &cwd),
        cwd,
        model: thread.model.clone().or_else(|| summary.as_ref().and_then(|s| s.model.clone())),
        pid,
        status,
        tokens,
        progress: Progress::resolve(summary.as_ref().and_then(|s| s.plan), status, &tokens),
        current_step: summary.as_ref().and_then(|s| s.step.clone()),
        started_at: thread.created_at_ms,
        updated_at: thread.updated_at_ms.max(modified),
        subagents,
    }
}

/// Edge `closed`/`completed` → done; otherwise the child rollout decides,
/// with "written < 30 s ago" counting as running.
fn subagent(edge_status: &str, child: &ThreadRow, now_ms: i64, cache: &mut Cache) -> SubAgent {
    let (summary, modified) = fold(child, cache);
    let modified = modified_ms(&child.rollout_path).unwrap_or(modified);
    let rollout_status = summary.as_ref().map_or(AgentStatus::Idle, |s| s.status);
    let status = match edge_status {
        "closed" | "completed" | "done" => AgentStatus::Done,
        _ if rollout_status == AgentStatus::AwaitingApproval => AgentStatus::AwaitingApproval,
        _ if now_ms - modified < RUNNING_WINDOW_MS => AgentStatus::Running,
        _ => rollout_status,
    };
    let tokens = tokens(child, summary.as_ref());
    let cwd = child.cwd.to_string_lossy();
    SubAgent {
        id: child.id.clone(),
        title: title_or_dir([child.nickname.as_deref(), child.name.as_deref(), Some(child.title.as_str())], &cwd),
        kind: child.role.clone(),
        status,
        tokens,
        progress: Progress::resolve(summary.as_ref().and_then(|s| s.plan), status, &tokens),
        started_at: child.created_at_ms,
        updated_at: child.updated_at_ms.max(modified),
    }
}
