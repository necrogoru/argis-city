//! Maps OpenCode session rows to wire types.

use super::catalog::ModelCatalog;
use super::message::{awaiting_user, child_status, current_step, latest_turn, model_ref, session_status, Turn};
use super::store::{OpenCodeStore, SessionRow};
use crate::domain::{AgentSession, PlanCounts, Progress, ProviderId, SubAgent};
use crate::shared::text::title_or_dir;

fn plan(store: &OpenCodeStore, session: &str) -> anyhow::Result<Option<PlanCounts>> {
    let statuses = store.todo_statuses(session)?;
    Ok((!statuses.is_empty()).then(|| PlanCounts::from_statuses(statuses.iter().map(String::as_str))))
}

/// The session's model (row JSON first, latest message second) and its
/// context window from the catalog.
fn model_and_window(models: &ModelCatalog, row: &SessionRow, turn: &Turn) -> (Option<String>, Option<u64>) {
    let (provider, id) = match model_ref(row.model.as_deref()) {
        Some((provider, id)) => (provider.or_else(|| turn.model_provider.clone()), Some(id)),
        None => (turn.model_provider.clone(), turn.model.clone()),
    };
    let window = id.as_deref().and_then(|m| models.context_window(provider.as_deref(), m));
    (id, window)
}

pub struct Sources<'a> {
    pub store: &'a OpenCodeStore,
    pub models: &'a ModelCatalog,
}

pub fn session(src: &Sources, row: &SessionRow, pid: Option<u32>, now_ms: i64) -> anyhow::Result<AgentSession> {
    let store = src.store;
    let activity = store.activity(row)?;
    let turn = latest_turn(&activity.messages);
    let status = session_status(&turn, awaiting_user(&activity.parts));
    let (model, window) = model_and_window(src.models, row, &turn);
    let tokens = row.tokens.with_context(turn.context_used, window);
    let cwd = row.directory.to_string_lossy().into_owned();
    let mut subagents =
        store.children(row)?.iter().map(|child| subagent(src, child, now_ms)).collect::<anyhow::Result<Vec<_>>>()?;
    subagents.sort_by_key(|s| s.started_at);
    Ok(AgentSession {
        id: ProviderId::Opencode.session_id(&row.id),
        provider: ProviderId::Opencode,
        title: title_or_dir([Some(row.title.as_str())], &cwd),
        cwd,
        model,
        pid,
        status,
        tokens,
        progress: Progress::resolve(plan(store, &row.id)?, status, &tokens),
        current_step: current_step(&activity.parts),
        started_at: row.time_created,
        updated_at: row.time_updated,
        subagents,
    })
}

fn subagent(src: &Sources, row: &SessionRow, now_ms: i64) -> anyhow::Result<SubAgent> {
    let store = src.store;
    let activity = store.activity(row)?;
    let turn = latest_turn(&activity.messages);
    let status = child_status(&turn, awaiting_user(&activity.parts), row.time_updated, now_ms);
    let (_, window) = model_and_window(src.models, row, &turn);
    let tokens = row.tokens.with_context(turn.context_used, window);
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
