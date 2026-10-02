//! Codex: thread index (`state_*.sqlite`) + rollout JSONL under `~/.codex`.

mod build;
mod index;
mod rollout;

#[cfg(test)]
mod tests;

use super::{candidate_since, AgentProvider, CollectContext};
use crate::domain::{AgentSession, ProviderId};
use crate::shared::jsonl::JsonlTailCache;
use crate::shared::liveness::{written_recently, ToolProcesses};
use crate::system::clock::system_time_ms;
use index::{newest_state_db, CodexIndex};
use parking_lot::Mutex;
use rollout::RolloutState;
use std::fs;
use std::path::{Path, PathBuf};

pub struct CodexProvider {
    root: PathBuf,
    rollouts: Mutex<JsonlTailCache<RolloutState>>,
}

impl CodexProvider {
    /// `root` is the Codex home (`~/.codex`).
    pub fn new(root: PathBuf) -> Self {
        Self { root, rollouts: Mutex::new(JsonlTailCache::new()) }
    }
}

pub(crate) fn modified_ms(path: &Path) -> Option<i64> {
    fs::metadata(path).and_then(|m| m.modified()).ok().map(system_time_ms)
}

impl AgentProvider for CodexProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Codex
    }

    fn is_available(&self) -> bool {
        self.root.is_dir()
    }

    fn collect(&self, ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>> {
        let Some(db) = newest_state_db(&self.root) else { return Ok(Vec::new()) };
        let index = CodexIndex::open(&db)?;
        let procs = ToolProcesses::find(&ctx.processes, "codex");
        let threads = index.recent_threads(candidate_since(ctx.now_ms, procs.earliest_start()))?;
        let owners = procs.assign(&threads, |t| t.cwd.as_path(), |t| t.updated_at_ms);
        let mut cache = self.rollouts.lock();
        let mut sessions = Vec::new();
        for (i, thread) in threads.iter().enumerate() {
            let pid = owners.get(&i).copied();
            let recent = modified_ms(&thread.rollout_path).is_some_and(|m| written_recently(m, ctx.now_ms));
            if pid.is_none() && !recent {
                continue;
            }
            let children = index.children(&thread.id)?;
            sessions.push(build::session(thread, pid, &children, ctx.now_ms, &mut cache));
        }
        cache.sweep();
        Ok(sessions)
    }
}
