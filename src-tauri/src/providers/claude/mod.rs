//! Claude Code: live registry + transcripts + subagents under `~/.claude`.

mod plan;
mod registry;
mod session;
mod status;
mod subagents;
mod transcript;
mod usage;

#[cfg(test)]
mod tests;

use super::{AgentProvider, CollectContext};
use crate::domain::{AgentSession, ProviderId};
use crate::shared::jsonl::JsonlTailCache;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use transcript::TranscriptState;

pub struct ClaudeProvider {
    root: PathBuf,
    transcripts: Mutex<JsonlTailCache<TranscriptState>>,
    locations: Mutex<HashMap<String, PathBuf>>,
}

impl ClaudeProvider {
    /// `root` is the Claude config dir (`~/.claude`).
    pub fn new(root: PathBuf) -> Self {
        Self { root, transcripts: Mutex::new(JsonlTailCache::new()), locations: Mutex::new(HashMap::new()) }
    }

    /// `projects/*/<sessionId>.jsonl` — the project dir is where the session
    /// started, not necessarily its current cwd. Cached once found.
    fn locate(&self, session_id: &str) -> Option<PathBuf> {
        let mut locations = self.locations.lock();
        if let Some(path) = locations.get(session_id).filter(|p| p.is_file()) {
            return Some(path.clone());
        }
        let found = find_transcript(&self.root.join("projects"), session_id)?;
        locations.insert(session_id.to_owned(), found.clone());
        Some(found)
    }
}

fn find_transcript(projects: &Path, session_id: &str) -> Option<PathBuf> {
    let file = format!("{session_id}.jsonl");
    fs::read_dir(projects)
        .ok()?
        .flatten()
        .map(|dir| dir.path().join(&file))
        .filter_map(|p| p.metadata().and_then(|m| m.modified()).ok().map(|t| (t, p)))
        .max_by_key(|(t, _)| *t)
        .map(|(_, p)| p)
}

impl AgentProvider for ClaudeProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Claude
    }

    fn is_available(&self) -> bool {
        self.root.is_dir()
    }

    fn collect(&self, ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>> {
        let entries = registry::read_registry(&self.root.join("sessions"));
        let live = registry::live_entries(entries, &ctx.processes);
        let mut cache = self.transcripts.lock();
        let sessions = live
            .iter()
            .map(|(entry, proc)| {
                let transcript = self.locate(&entry.session_id);
                session::build(entry, proc.pid, transcript.as_deref(), ctx, &mut cache)
            })
            .collect();
        cache.sweep();
        Ok(sessions)
    }
}
