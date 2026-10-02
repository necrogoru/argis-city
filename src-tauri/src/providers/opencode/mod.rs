//! OpenCode: sessions, messages, parts and todos in `opencode.db`.

mod build;
mod message;
mod store;

#[cfg(test)]
mod tests;

use super::{candidate_since, AgentProvider, CollectContext};
use crate::domain::{AgentSession, ProviderId};
use crate::shared::liveness::{written_recently, ToolProcesses};
use std::path::PathBuf;
use store::OpenCodeStore;

pub struct OpenCodeProvider {
    root: PathBuf,
}

impl OpenCodeProvider {
    /// `root` is OpenCode's data dir (`~/.local/share/opencode`).
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
}

impl AgentProvider for OpenCodeProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Opencode
    }

    fn is_available(&self) -> bool {
        self.root.is_dir()
    }

    fn collect(&self, ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>> {
        let db = self.root.join("opencode.db");
        if !db.is_file() {
            return Ok(Vec::new());
        }
        let store = OpenCodeStore::open(&db)?;
        let procs = ToolProcesses::find(&ctx.processes, "opencode");
        let roots = store.recent_roots(candidate_since(ctx.now_ms, procs.earliest_start()))?;
        let owners = procs.assign(&roots, |r| r.directory.as_path(), |r| r.time_updated);
        let mut sessions = Vec::new();
        for (i, row) in roots.iter().enumerate() {
            let pid = owners.get(&i).copied();
            if pid.is_none() && !written_recently(row.time_updated, ctx.now_ms) {
                continue;
            }
            sessions.push(build::session(&store, row, pid, ctx.now_ms)?);
        }
        Ok(sessions)
    }
}
