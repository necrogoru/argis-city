//! Maps OpenCode session rows to wire types.

use super::message::{child_status, current_step, latest_turn, model_id, session_status};
use super::store::{OpenCodeStore, SessionRow};
use crate::domain::{AgentSession, PlanCounts, Progress, ProviderId, SubAgent};
use crate::shared::text::title_or_dir;

const MESSAGE_LOOKBACK: u32 = 8;
const PART_LOOKBACK: u32 = 24;

fn plan(store: &OpenCodeStore, session: &str) -> anyhow::Result<Option<PlanCounts>> {
    let statuses = store.todo_statuses(session)?;
    Ok((!statuses.is_empty()).then(|| PlanCounts::from_statuses(statuses.iter().map(String::as_str))))
}

pub fn session(store: &OpenCodeStore, row: &SessionRow, pid: Option<u32>, now_ms: i64) -> anyhow::Result<AgentSession> {
    let turn = latest_turn(&store.latest_messages(&row.id, MESSAGE_LOOKBACK)?);
    let status = session_status(&turn);
    // The window size is not recorded by OpenCode, so it stays unknown.
    let tokens = row.tokens.with_context(turn.context_used, None);
    let cwd = row.directory.to_string_lossy().into_owned();
    let mut subagents = store
        .children(&row.id)?
        .iter()
        .map(|child| subagent(store, child, now_ms))
        .collect::<anyhow::Result<Vec<_>>>()?;
    subagents.sort_by_key(|s| s.started_at);
    Ok(AgentSession {
        id: ProviderId::Opencode.session_id(&row.id),
        provider: ProviderId::Opencode,
        title: title_or_dir([Some(row.title.as_str())], &cwd),
        cwd,
        model: model_id(row.model.as_deref()).or(turn.model),
        pid,
        status,
        tokens,
        progress: Progress::resolve(plan(store, &row.id)?, status, &tokens),
        current_step: current_step(&store.latest_parts(&row.id, PART_LOOKBACK)?),
        started_at: row.time_created,
        updated_at: row.time_updated,
        subagents,
    })
}

fn subagent(store: &OpenCodeStore, row: &SessionRow, now_ms: i64) -> anyhow::Result<SubAgent> {
    let turn = latest_turn(&store.latest_messages(&row.id, MESSAGE_LOOKBACK)?);
    let status = child_status(&turn, row.time_updated, now_ms);
    let tokens = row.tokens.with_context(turn.context_used, None);
    Ok(SubAgent {
        id: row.id.clone(),
        title: title_or_dir([Some(row.title.as_str())], &row.directory.to_string_lossy()),
        kind: row.agent.clone(),
        status,
        tokens,
        progress: Progress::resolve(plan(store, &row.id)?, status, &tokens),
        started_at: row.time_created,
        updated_at: row.time_updated,
    })
}
