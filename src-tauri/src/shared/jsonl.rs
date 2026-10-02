//! Incremental JSONL tail reader.
//!
//! Transcripts can be tens of MB and are polled every 2 s, so each file keeps
//! a byte offset plus a provider-specific folded state; only appended lines
//! are parsed on later reads. A shrunk or replaced file is re-read from 0.

use crate::system::clock::system_time_ms;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, File, Metadata};
use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// Provider-specific accumulator fed one parsed line at a time.
pub trait LineFold: Default {
    fn apply(&mut self, line: &Value);
}

/// File facts captured at read time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FileMeta {
    pub modified_ms: i64,
    pub created_ms: Option<i64>,
    pub len: u64,
}

struct Entry<S> {
    offset: u64,
    identity: u64,
    state: S,
    touched: bool,
}

impl<S: Default> Entry<S> {
    fn fresh(identity: u64) -> Self {
        Self { offset: 0, identity, state: S::default(), touched: true }
    }
}

/// Per-path cache of folded JSONL state.
pub struct JsonlTailCache<S> {
    entries: HashMap<PathBuf, Entry<S>>,
}

impl<S: LineFold> Default for JsonlTailCache<S> {
    fn default() -> Self {
        Self { entries: HashMap::new() }
    }
}

impl<S: LineFold> JsonlTailCache<S> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Folds any newly appended lines of `path`, then hands the state to `f`.
    pub fn read_with<R>(&mut self, path: &Path, f: impl FnOnce(&S, FileMeta) -> R) -> io::Result<R> {
        let meta = fs::metadata(path)?;
        let file_meta = file_meta(&meta);
        let identity = identity(&meta);
        let entry = self.entries.entry(path.to_path_buf()).or_insert_with(|| Entry::fresh(identity));
        if file_meta.len < entry.offset || entry.identity != identity {
            *entry = Entry::fresh(identity);
        }
        entry.touched = true;
        if file_meta.len > entry.offset {
            fold_appended(path, entry, file_meta.len)?;
        }
        Ok(f(&entry.state, file_meta))
    }

    /// Drops entries not read since the previous sweep (files that vanished
    /// or stopped being relevant), keeping memory bounded.
    pub fn sweep(&mut self) {
        self.entries.retain(|_, e| std::mem::take(&mut e.touched));
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

fn fold_appended<S: LineFold>(path: &Path, entry: &mut Entry<S>, len: u64) -> io::Result<()> {
    let mut file = File::open(path)?;
    file.seek(SeekFrom::Start(entry.offset))?;
    let mut reader = BufReader::with_capacity(256 * 1024, file).take(len - entry.offset);
    let mut buf = Vec::with_capacity(8 * 1024);
    loop {
        buf.clear();
        let n = reader.read_until(b'\n', &mut buf)?;
        if n == 0 {
            return Ok(());
        }
        let complete = buf.last() == Some(&b'\n');
        let parsed = serde_json::from_slice::<Value>(&buf).ok();
        if !complete && !parsed.as_ref().is_some_and(Value::is_object) {
            // A line still being written: retry from here next time.
            return Ok(());
        }
        entry.offset += n as u64;
        if let Some(line) = parsed {
            entry.state.apply(&line);
        }
    }
}

fn file_meta(meta: &Metadata) -> FileMeta {
    FileMeta {
        modified_ms: meta.modified().map(system_time_ms).unwrap_or(0),
        created_ms: meta.created().ok().map(system_time_ms),
        len: meta.len(),
    }
}

#[cfg(unix)]
fn identity(meta: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    meta.ino()
}

#[cfg(not(unix))]
fn identity(_meta: &Metadata) -> u64 {
    0
}

#[cfg(test)]
#[path = "jsonl_tests.rs"]
mod tests;
