//! Assembles one Claude `AgentSession` from registry + transcript + subagents.

use super::registry::{registry_status, RegistryEntry};
use super::status::{session_status, subagent_status, StatusEnv};
use super::subagents::{discover, to_subagent};
use super::transcript::{TranscriptState, TranscriptSummary};
use crate::domain::{AgentSession, AgentStatus, Progress, ProviderId, SubAgent, TokenUsage};
use crate::providers::CollectContext;
use crate::shared::jsonl::{FileMeta, JsonlTailCache};
use crate::shared::text::title_or_dir;
use std::path::Path;

type Cache = JsonlTailCache<TranscriptState>;

pub fn build(
    entry: &RegistryEntry,
    pid: u32,
    transcript: Option<&Path>,
    ctx: &CollectContext,
    cache: &mut Cache,
) -> AgentSession {
    let env = StatusEnv { now_ms: ctx.now_ms, pid, processes: &ctx.processes };
    let registry = registry_status(entry.status.as_deref());
    let folded = transcript.and_then(|p| cache.read_with(p, |s, m| (s.summary(), m)).ok());
    let (status, summary, modified) = match &folded {
        Some((s, meta)) => (session_status(registry, s, meta.modified_ms, &env), Some(s), Some(meta.modified_ms)),
        None => (registry, None, None),
    };
    let subagents = match transcript {
        Some(path) => build_subagents(path, entry, status, &env, cache),
        None => Vec::new(),
    };
    let tokens = summary.map(|s| s.tokens).unwrap_or_default();
    let title = title_or_dir([summary.and_then(|s| s.title.as_deref()), entry.name.as_deref()], &entry.cwd);
    AgentSession {
        id: ProviderId::Claude.session_id(&entry.session_id),
        provider: ProviderId::Claude,
        title,
        cwd: entry.cwd.clone(),
        model: summary.and_then(|s| s.model.clone()),
        pid: Some(pid),
        status,
        tokens,
        progress: progress(summary, status, &tokens),
        current_step: summary.and_then(|s| s.step.clone()),
        started_at: entry.started_at,
        updated_at: modified.into_iter().chain(entry.updated_at).max().unwrap_or(entry.started_at),
        subagents,
    }
}

fn progress(summary: Option<&TranscriptSummary>, status: AgentStatus, tokens: &TokenUsage) -> Progress {
    Progress::resolve(summary.and_then(|s| s.plan), status, tokens)
}

fn build_subagents(
    transcript: &Path,
    entry: &RegistryEntry,
    parent: AgentStatus,
    env: &StatusEnv,
    cache: &mut Cache,
) -> Vec<SubAgent> {
    let mut out: Vec<SubAgent> = discover(transcript, &entry.session_id, entry.started_at)
        .iter()
        .filter_map(|file| {
            let (summary, meta): (TranscriptSummary, FileMeta) =
                cache.read_with(&file.path, |s, m| (s.summary(), m)).ok()?;
            let status = subagent_status(&summary, meta.modified_ms, parent, env);
            Some(to_subagent(file, &summary, meta, status))
        })
        .collect();
    out.sort_by_key(|s| s.started_at);
    out
}
