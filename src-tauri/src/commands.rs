//! Tauri commands (see docs/CONTRACT.md → Transport).

use crate::domain::{Project, Snapshot, Task, TaskStatus};
use crate::git_worktrees::{
    create_task_worktree as create_git_worktree, delete_task_with_git_cleanup, inspect_task_git, TaskDeletionOutcome,
    TaskGitStatus, TaskWorktree,
};
use crate::monitor::Monitor;
use crate::project_paths::register_project as register_project_path;
use crate::task_store::{TaskStore, TaskStoreState};
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

#[tauri::command]
pub async fn list_projects(state: State<'_, TaskStoreState>) -> Result<Vec<Project>, String> {
    task_store_operation(state, |store| store.list_projects()).await
}

#[tauri::command]
pub async fn register_project(
    path: String,
    create_if_missing: bool,
    state: State<'_, TaskStoreState>,
) -> Result<Project, String> {
    task_store_operation(state, move |store| register_project_path(&store, Path::new(&path), create_if_missing)).await
}

#[tauri::command]
pub async fn list_tasks(project_id: Option<i64>, state: State<'_, TaskStoreState>) -> Result<Vec<Task>, String> {
    task_store_operation(state, move |store| store.list_tasks(project_id)).await
}

#[tauri::command]
pub async fn create_task(
    project_id: i64,
    title: String,
    description: String,
    state: State<'_, TaskStoreState>,
) -> Result<Task, String> {
    task_store_operation(state, move |store| store.create_task(project_id, &title, &description)).await
}

#[tauri::command]
pub async fn update_task_details(
    id: i64,
    title: String,
    description: String,
    state: State<'_, TaskStoreState>,
) -> Result<Task, String> {
    task_store_operation(state, move |store| store.update_task_details(id, &title, &description)).await
}

#[tauri::command]
pub async fn update_task_status(id: i64, status: TaskStatus, state: State<'_, TaskStoreState>) -> Result<Task, String> {
    task_store_operation(state, move |store| store.update_task_status(id, status)).await
}

#[tauri::command]
pub async fn delete_task(
    id: i64,
    remove_git_resources: bool,
    state: State<'_, TaskStoreState>,
) -> Result<TaskDeletionOutcome, String> {
    task_store_operation(state, move |store| delete_task_with_git_cleanup(&store, id, remove_git_resources)).await
}

#[tauri::command]
pub async fn inspect_task_git_status(task_id: i64, state: State<'_, TaskStoreState>) -> Result<TaskGitStatus, String> {
    task_store_operation(state, move |store| inspect_task_git(&store, task_id)).await
}

#[tauri::command]
pub async fn create_task_worktree(task_id: i64, state: State<'_, TaskStoreState>) -> Result<TaskWorktree, String> {
    task_store_operation(state, move |store| create_git_worktree(&store, task_id)).await
}

async fn task_store_operation<T>(
    state: State<'_, TaskStoreState>,
    operation: impl FnOnce(Arc<TaskStore>) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String>
where
    T: Send + 'static,
{
    let store = state.store()?;
    tauri::async_runtime::spawn_blocking(move || operation(store).map_err(|error| error.to_string()))
        .await
        .map_err(|error| error.to_string())?
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
