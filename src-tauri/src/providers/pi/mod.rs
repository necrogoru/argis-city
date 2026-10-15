//! Pi coding agent: per-cwd session JSONL under `~/.pi/agent/sessions`.

mod discover;
mod transcript;

#[cfg(test)]
mod tests;

use super::{AgentProvider, CollectContext};
use crate::domain::{AgentSession, Progress, ProviderId};
use crate::shared::jsonl::JsonlTailCache;
use crate::shared::liveness::ToolProcesses;
use crate::shared::text::title_or_dir;
use discover::{live_files, Candidate};
use parking_lot::Mutex;
use std::path::Path;
use std::path::PathBuf;
use std::{
    fs,
    io::{BufRead, BufReader},
};
use transcript::PiState;

pub struct PiProvider {
    root: PathBuf,
    transcripts: Mutex<JsonlTailCache<PiState>>,
}

impl PiProvider {
    /// `root` is Pi's agent dir (`~/.pi/agent`).
    pub fn new(root: PathBuf) -> Self {
        Self { root, transcripts: Mutex::new(JsonlTailCache::new()) }
    }
}

pub(crate) fn has_resume_reference(root: &Path, session_id: &str, worktree: &Path) -> bool {
    let worktree = crate::shared::liveness::canonical(worktree);
    let sessions_dir = root.join("sessions").join(discover::encode_cwd(&worktree));
    let Ok(entries) = fs::read_dir(sessions_dir) else { return false };

    entries.flatten().any(|entry| {
        let path = entry.path();
        if !path.extension().is_some_and(|extension| extension == "jsonl") {
            return false;
        }
        let Ok(file) = fs::File::open(&path) else { return false };
        let mut reader = BufReader::new(file);
        let mut first_line = String::new();
        if reader.read_line(&mut first_line).is_err() {
            return false;
        }
        let Ok(header) = serde_json::from_str::<serde_json::Value>(&first_line) else { return false };
        let native = header
            .get("id")
            .and_then(serde_json::Value::as_str)
            .or_else(|| path.file_stem().and_then(|stem| stem.to_str()));
        let cwd = header.get("cwd").and_then(serde_json::Value::as_str).map(Path::new);
        native == Some(session_id) && cwd.is_some_and(|cwd| crate::shared::liveness::canonical(cwd) == worktree)
    })
}

impl AgentProvider for PiProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Pi
    }

    fn is_available(&self) -> bool {
        self.root.is_dir()
    }

    fn collect(&self, ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>> {
        let procs = ToolProcesses::find(&ctx.processes, "pi");
        let candidates = live_files(&self.root.join("sessions"), &procs, ctx.now_ms);
        let mut cache = self.transcripts.lock();
        let sessions = candidates.iter().filter_map(|c| session(c, &mut cache)).collect();
        cache.sweep();
        Ok(sessions)
    }
}

fn session(candidate: &Candidate, cache: &mut JsonlTailCache<PiState>) -> Option<AgentSession> {
    let (s, meta) = cache.read_with(&candidate.path, |s, m| (s.summary(), m)).ok()?;
    let stem = candidate.path.file_stem()?.to_string_lossy().into_owned();
    let native = s.id.clone().unwrap_or(stem);
    let cwd = s.cwd.clone().unwrap_or_default();
    Some(AgentSession {
        id: ProviderId::Pi.session_id(&native),
        provider: ProviderId::Pi,
        title: title_or_dir([s.title.as_deref()], &cwd),
        cwd,
        model: s.model.clone(),
        pid: candidate.pid,
        status: s.status,
        tokens: s.tokens,
        progress: Progress::resolve(None, s.status, &s.tokens),
        current_step: s.step.clone(),
        started_at: s.started_ms.or(meta.created_ms).unwrap_or(meta.modified_ms),
        updated_at: meta.modified_ms,
        subagents: Vec::new(),
    })
}
