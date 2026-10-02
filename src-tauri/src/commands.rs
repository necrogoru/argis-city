//! Tauri commands (see docs/CONTRACT.md → Transport).

use crate::domain::Snapshot;
use crate::monitor::Monitor;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

/// Latest cached snapshot (collects once if none exists yet).
#[tauri::command]
pub async fn get_snapshot(monitor: State<'_, Arc<Monitor>>) -> Result<Snapshot, String> {
    let monitor = Arc::clone(&monitor);
    tauri::async_runtime::spawn_blocking(move || monitor.latest()).await.map_err(|e| e.to_string())
}

/// Forces a collect now.
#[tauri::command]
pub async fn refresh_snapshot(monitor: State<'_, Arc<Monitor>>) -> Result<Snapshot, String> {
    let monitor = Arc::clone(&monitor);
    tauri::async_runtime::spawn_blocking(move || monitor.refresh()).await.map_err(|e| e.to_string())
}

/// Opens an existing directory (a session's cwd) in Finder.
#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    let dir = existing_dir(&path)?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

/// Validates that `path` is an absolute path to an existing directory.
fn existing_dir(path: &str) -> Result<PathBuf, String> {
    let raw = Path::new(path);
    if !raw.is_absolute() {
        return Err(format!("not an absolute path: {path:?}"));
    }
    let dir = fs::canonicalize(raw).map_err(|_| format!("path does not exist: {path}"))?;
    if !dir.is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_directories() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(existing_dir(&dir.path().to_string_lossy()).is_ok());
        assert!(existing_dir(&file.to_string_lossy()).unwrap_err().contains("not a directory"));
        assert!(existing_dir("/definitely/not/here").unwrap_err().contains("does not exist"));
        assert!(existing_dir("relative/dir").unwrap_err().contains("absolute"));
    }
}
