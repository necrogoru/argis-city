//! Finds live Pi session files: `sessions/--<cwd with "/"→"-">--/*.jsonl`.

use crate::shared::liveness::{written_recently, ToolProcesses};
use crate::system::clock::system_time_ms;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Candidate {
    pub path: PathBuf,
    pub modified_ms: i64,
    pub pid: Option<u32>,
}

/// Pi's per-cwd directory name.
pub fn encode_cwd(cwd: &Path) -> String {
    let s = cwd.to_string_lossy();
    let trimmed = s.trim_start_matches(['/', '\\']);
    format!("--{}--", trimmed.replace(['/', '\\', ':'], "-"))
}

/// Per cwd dir: each `pi` process there owns the newest file written after
/// it started; any other file written in the last 2 min is live too.
pub fn live_files(sessions_dir: &Path, procs: &ToolProcesses, now_ms: i64) -> Vec<Candidate> {
    let Ok(dirs) = fs::read_dir(sessions_dir) else { return Vec::new() };
    let mut out = Vec::new();
    for dir in dirs.flatten().filter(|d| d.path().is_dir()) {
        let name = dir.file_name().to_string_lossy().into_owned();
        let mut files = jsonl_files(&dir.path());
        files.sort_by_key(|(_, modified)| std::cmp::Reverse(*modified));
        let mut taken = HashSet::new();
        for (proc, _) in procs.iter().filter(|(_, cwd)| encode_cwd(cwd) == name) {
            let owned = files.iter().find(|(p, m)| !taken.contains(p) && *m >= proc.started_at_ms);
            if let Some((path, modified)) = owned {
                taken.insert(path.clone());
                out.push(Candidate { path: path.clone(), modified_ms: *modified, pid: Some(proc.pid) });
            }
        }
        for (path, modified) in files {
            if !taken.contains(&path) && written_recently(modified, now_ms) {
                out.push(Candidate { path, modified_ms: modified, pid: None });
            }
        }
    }
    out
}

fn jsonl_files(dir: &Path) -> Vec<(PathBuf, i64)> {
    let Ok(read) = fs::read_dir(dir) else { return Vec::new() };
    read.flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "jsonl"))
        .filter_map(|p| {
            let modified = fs::metadata(&p).and_then(|m| m.modified()).ok().map(system_time_ms)?;
            Some((p, modified))
        })
        .collect()
}
