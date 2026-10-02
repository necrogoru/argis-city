//! "Is this session live?" — owning-process match, with a recent-write fallback.

use crate::system::ProcessInfo;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

/// A transcript written within this window counts as live without a process.
pub const LIVE_WINDOW_MS: i64 = 120_000;

pub fn written_recently(modified_ms: i64, now_ms: i64) -> bool {
    now_ms - modified_ms <= LIVE_WINDOW_MS
}

/// Canonical form for cwd comparison; falls back to the trimmed input.
pub fn canonical(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| {
        let s = path.to_string_lossy();
        PathBuf::from(if s.len() > 1 { s.trim_end_matches('/') } else { &s })
    })
}

/// Live processes of one tool, with canonicalized working directories.
pub struct ToolProcesses<'a> {
    procs: Vec<(&'a ProcessInfo, PathBuf)>,
}

impl<'a> ToolProcesses<'a> {
    pub fn find(processes: &'a [ProcessInfo], tool: &str) -> Self {
        let mut procs: Vec<_> = processes
            .iter()
            .filter(|p| p.is_tool(tool))
            .filter_map(|p| p.cwd.as_deref().map(|c| (p, canonical(c))))
            .collect();
        // Newest first, so a fresh process claims the newest session.
        procs.sort_by_key(|(p, _)| std::cmp::Reverse(p.started_at_ms));
        Self { procs }
    }

    pub fn is_empty(&self) -> bool {
        self.procs.is_empty()
    }

    pub fn earliest_start(&self) -> Option<i64> {
        self.procs.iter().map(|(p, _)| p.started_at_ms).min()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&'a ProcessInfo, &Path)> {
        self.procs.iter().map(|(p, c)| (*p, c.as_path()))
    }

    /// Gives each process the most recently updated candidate in its cwd that
    /// was updated after the process started. Returns candidate index → pid.
    pub fn assign<T>(
        &self,
        candidates: &[T],
        cwd: impl Fn(&T) -> &Path,
        updated_ms: impl Fn(&T) -> i64,
    ) -> HashMap<usize, u32> {
        let cwds: Vec<PathBuf> = candidates.iter().map(|c| canonical(cwd(c))).collect();
        let mut taken = HashSet::new();
        let mut out = HashMap::new();
        for (proc, proc_cwd) in self.iter() {
            let best = (0..candidates.len())
                .filter(|i| !taken.contains(i) && cwds[*i] == proc_cwd)
                .filter(|i| updated_ms(&candidates[*i]) >= proc.started_at_ms)
                .max_by_key(|i| updated_ms(&candidates[*i]));
            if let Some(i) = best {
                taken.insert(i);
                out.insert(i, proc.pid);
            }
        }
        out
    }
}

/// True when `parent` has a child process that started at/after `since_ms`
/// (e.g. a shell running the pending tool call).
pub fn has_child_since(processes: &[ProcessInfo], parent: u32, since_ms: i64) -> bool {
    processes.iter().any(|p| p.parent_pid == Some(parent) && p.started_at_ms + 1000 >= since_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(pid: u32, cwd: &Path, started: i64) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid: None,
            name: "codex".into(),
            cmd: vec![],
            cwd: Some(cwd.to_path_buf()),
            started_at_ms: started,
        }
    }

    #[test]
    fn assigns_newest_matching_candidate_updated_after_start() {
        let dir = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let procs = vec![proc(7, dir.path(), 1_000)];
        let tools = ToolProcesses::find(&procs, "codex");
        let cands = vec![
            (dir.path().to_path_buf(), 500),
            (dir.path().join("."), 2_000),
            (dir.path().to_path_buf(), 1_500),
            (other.path().to_path_buf(), 9_000),
        ];
        let got = tools.assign(&cands, |c| c.0.as_path(), |c| c.1);
        assert_eq!(got, HashMap::from([(1, 7)]));
    }

    #[test]
    fn recent_window_and_child_detection() {
        assert!(written_recently(1_000, 1_000 + LIVE_WINDOW_MS));
        assert!(!written_recently(1_000, 1_001 + LIVE_WINDOW_MS));
        let mut child = proc(9, Path::new("/"), 5_000);
        child.parent_pid = Some(3);
        assert!(has_child_since(&[child.clone()], 3, 5_500));
        assert!(!has_child_since(&[child], 3, 9_000));
    }
}
