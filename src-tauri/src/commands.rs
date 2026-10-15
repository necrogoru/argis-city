//! Tauri commands (see docs/CONTRACT.md → Transport).

use crate::domain::{
    Project, Snapshot, Task, TaskStatus, TerminalAgent, TerminalAttachment, TerminalEvent, TerminalInventoryEntry,
    TerminalSessionKey, TerminalSize, TerminalTab,
};
use crate::git_worktrees::{
    create_task_worktree as create_git_worktree, delete_task_with_git_cleanup, inspect_task_git,
    validated_task_worktree_path, TaskDeletionOutcome, TaskGitStatus, TaskWorktree,
};
use crate::monitor::Monitor;
use crate::project_paths::register_project as register_project_path;
use crate::task_store::{TaskStore, TaskStoreState};
use crate::terminal_manager::{TerminalEventSink, TerminalManager, TerminalProcessSpec};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tauri::ipc::Channel;
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
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> Result<TaskDeletionOutcome, String> {
    let manager = Arc::clone(&terminal_state);
    task_store_operation(state, move |store| {
        delete_task_with_terminal_cleanup(&store, &manager, id, remove_git_resources)
    })
    .await
}

#[tauri::command]
pub async fn inspect_task_git_status(task_id: i64, state: State<'_, TaskStoreState>) -> Result<TaskGitStatus, String> {
    task_store_operation(state, move |store| inspect_task_git(&store, task_id)).await
}

#[tauri::command]
pub async fn create_task_worktree(task_id: i64, state: State<'_, TaskStoreState>) -> Result<TaskWorktree, String> {
    task_store_operation(state, move |store| create_git_worktree(&store, task_id)).await
}

#[tauri::command]
pub async fn start_terminal_session(
    task_id: i64,
    tab: TerminalTab,
    agent_cli: Option<TerminalAgent>,
    size: TerminalSize,
    on_event: Channel<TerminalEvent>,
    task_state: State<'_, TaskStoreState>,
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> Result<TerminalAttachment, String> {
    let store = task_state.store()?;
    let manager = Arc::clone(&terminal_state);
    let sink = terminal_event_sink(on_event);
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = validated_task_worktree_path(&store, task_id)?;
        let spec = terminal_process_spec(task_id, tab, agent_cli, cwd, size)?;
        manager.start_or_reattach_with_attachment(spec, sink)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn reattach_terminal_session(
    task_id: i64,
    tab: TerminalTab,
    on_event: Channel<TerminalEvent>,
    task_state: State<'_, TaskStoreState>,
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> Result<Option<TerminalAttachment>, String> {
    let store = task_state.store()?;
    let manager = Arc::clone(&terminal_state);
    let sink = terminal_event_sink(on_event);
    tauri::async_runtime::spawn_blocking(move || {
        validated_task_worktree_path(&store, task_id)?;
        Ok(manager.reattach_if_present_with_attachment(TerminalSessionKey { task_id, tab }, sink))
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error: anyhow::Error| error.to_string())
}

#[tauri::command]
pub async fn terminal_input(
    session_id: u64,
    data: String,
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> Result<(), String> {
    let manager = Arc::clone(&terminal_state);
    tauri::async_runtime::spawn_blocking(move || {
        manager.input(session_id, data.as_bytes()).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn resize_terminal_session(
    session_id: u64,
    size: TerminalSize,
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> Result<(), String> {
    let manager = Arc::clone(&terminal_state);
    tauri::async_runtime::spawn_blocking(move || manager.resize(session_id, size).map_err(|error| error.to_string()))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn detach_terminal_session(
    task_id: i64,
    tab: TerminalTab,
    attachment_id: u64,
    terminal_state: State<'_, Arc<TerminalManager>>,
) -> bool {
    terminal_state.detach_attachment(TerminalSessionKey { task_id, tab }, attachment_id)
}

#[tauri::command]
pub fn list_terminal_inventory(terminal_state: State<'_, Arc<TerminalManager>>) -> Vec<TerminalInventoryEntry> {
    terminal_state.inventory()
}

/// Plays macOS's built-in Ping sound as a fallback when a desktop notification cannot be delivered.
#[tauri::command]
pub async fn play_alert_sound() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let status = Command::new("/usr/bin/afplay")
            .arg("/System/Library/Sounds/Ping.aiff")
            .status()
            .map_err(|error| format!("could not start macOS alert sound: {error}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("macOS alert sound exited with {status}"))
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

fn terminal_event_sink(channel: Channel<TerminalEvent>) -> TerminalEventSink {
    Arc::new(move |event| channel.send(event).map_err(|error| error.to_string()))
}

fn delete_task_with_terminal_cleanup(
    store: &TaskStore,
    manager: &TerminalManager,
    task_id: i64,
    remove_git_resources: bool,
) -> anyhow::Result<TaskDeletionOutcome> {
    store.get_task(task_id)?;
    manager.stop_task_sessions(task_id)?;
    let outcome = delete_task_with_git_cleanup(store, task_id, remove_git_resources);
    manager.finish_task_deletion(task_id, outcome.as_ref().is_ok_and(|result| result.task_deleted));
    outcome
}

fn terminal_process_spec(
    task_id: i64,
    tab: TerminalTab,
    agent_cli: Option<TerminalAgent>,
    cwd: PathBuf,
    size: TerminalSize,
) -> anyhow::Result<TerminalProcessSpec> {
    let (program, args) = match (tab, agent_cli) {
        (TerminalTab::Agent, Some(agent)) => (PathBuf::from(agent.executable()), Vec::new()),
        (TerminalTab::Agent, None) => return Err(anyhow::anyhow!("select an agent CLI before starting the Agent tab")),
        (TerminalTab::Term, Some(_)) => return Err(anyhow::anyhow!("the shell tab cannot start an agent CLI")),
        (TerminalTab::Term, None) => shell_program(),
    };
    Ok(TerminalProcessSpec { key: TerminalSessionKey { task_id, tab }, agent_cli, program, args, cwd, size })
}

#[cfg(windows)]
fn shell_program() -> (PathBuf, Vec<String>) {
    let program = std::env::var_os("COMSPEC").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("cmd.exe"));
    (program, Vec::new())
}

#[cfg(target_os = "macos")]
fn shell_program() -> (PathBuf, Vec<String>) {
    let program = std::env::var_os("SHELL").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/bin/zsh"));
    (program, Vec::new())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn shell_program() -> (PathBuf, Vec<String>) {
    let program = std::env::var_os("SHELL").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/bin/sh"));
    (program, Vec::new())
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
    use std::process::Command;

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

    #[test]
    fn agent_terminal_specs_use_only_the_selected_allowlisted_executable() {
        let cwd = PathBuf::from("/project/.argis/worktrees/12-terminal-task");
        let spec = terminal_process_spec(
            12,
            TerminalTab::Agent,
            Some(TerminalAgent::Claude),
            cwd.clone(),
            TerminalSize::default(),
        )
        .unwrap();

        assert_eq!(spec.key.task_id, 12);
        assert_eq!(spec.key.tab, TerminalTab::Agent);
        assert_eq!(spec.agent_cli, Some(TerminalAgent::Claude));
        assert_eq!(spec.program, PathBuf::from("claude"));
        assert!(spec.args.is_empty());
        assert_eq!(spec.cwd, cwd);
    }

    #[test]
    fn terminal_process_specs_reject_agent_and_shell_selection_mismatches() {
        let cwd = PathBuf::from("/project/.argis/worktrees/13-terminal-task");

        assert!(terminal_process_spec(13, TerminalTab::Agent, None, cwd.clone(), TerminalSize::default(),).is_err());
        assert!(terminal_process_spec(13, TerminalTab::Term, Some(TerminalAgent::Pi), cwd, TerminalSize::default(),)
            .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn task_deletion_stops_a_terminal_before_removing_its_worktree() {
        let parent = tempfile::tempdir().unwrap();
        let (store, task, worktree) = task_with_worktree(parent.path());
        let manager = TerminalManager::default();
        let spec = TerminalProcessSpec {
            key: TerminalSessionKey { task_id: task.id, tab: TerminalTab::Term },
            agent_cli: None,
            program: PathBuf::from("/bin/sh"),
            args: vec!["-c".to_owned(), "sleep 30".to_owned()],
            cwd: PathBuf::from(&worktree.worktree_path),
            size: TerminalSize::default(),
        };
        manager.start(spec, Arc::new(|_| Ok(()))).unwrap();

        let result = delete_task_with_terminal_cleanup(&store, &manager, task.id, true).unwrap();

        assert!(result.task_deleted);
        assert!(result.git.worktree_removed);
        assert_eq!(manager.active_session_count(), 0);
        assert!(!Path::new(&worktree.worktree_path).exists());
        assert!(store.get_task(task.id).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn task_deletion_stops_sessions_even_when_git_resources_are_kept() {
        let parent = tempfile::tempdir().unwrap();
        let (store, task, worktree) = task_with_worktree(parent.path());
        let manager = TerminalManager::default();
        let spec = TerminalProcessSpec {
            key: TerminalSessionKey { task_id: task.id, tab: TerminalTab::Term },
            agent_cli: None,
            program: PathBuf::from("/bin/sh"),
            args: vec!["-c".to_owned(), "sleep 30".to_owned()],
            cwd: PathBuf::from(&worktree.worktree_path),
            size: TerminalSize::default(),
        };
        manager.start(spec, Arc::new(|_| Ok(()))).unwrap();

        let result = delete_task_with_terminal_cleanup(&store, &manager, task.id, false).unwrap();

        assert!(result.task_deleted);
        assert!(!result.git.worktree_removed);
        assert_eq!(manager.active_session_count(), 0);
        assert!(Path::new(&worktree.worktree_path).is_dir());
        assert!(store.get_task(task.id).is_err());
    }

    #[test]
    fn task_deletion_aborts_and_preserves_git_resources_if_terminal_manager_cannot_stop() {
        let parent = tempfile::tempdir().unwrap();
        let (store, task, worktree) = task_with_worktree(parent.path());
        let manager = TerminalManager::default();
        manager.shutdown().unwrap();

        let error = delete_task_with_terminal_cleanup(&store, &manager, task.id, true).unwrap_err();

        assert!(error.to_string().contains("shutting down"));
        assert!(store.get_task(task.id).is_ok());
        assert!(Path::new(&worktree.worktree_path).is_dir());
    }

    fn task_with_worktree(parent: &Path) -> (TaskStore, Task, TaskWorktree) {
        let project_path = parent.join("project");
        fs::create_dir(&project_path).unwrap();
        git_success(&project_path, &["init", "-q"]);
        git_success(&project_path, &["config", "user.email", "test@example.invalid"]);
        git_success(&project_path, &["config", "user.name", "Argis Test"]);
        fs::write(project_path.join("README.md"), "test\n").unwrap();
        git_success(&project_path, &["add", "README.md"]);
        git_success(&project_path, &["commit", "-qm", "initial"]);

        let store = TaskStore::open(&parent.join("argis.sqlite")).unwrap();
        let project = register_project_path(&store, &project_path, false).unwrap();
        let task = store.create_task(project.id, "Terminal cleanup", "").unwrap();
        let worktree = create_git_worktree(&store, task.id).unwrap();
        (store, task, worktree)
    }

    fn git_success(path: &Path, args: &[&str]) {
        let output = Command::new("git").arg("-C").arg(path).args(args).output().unwrap();
        assert!(output.status.success(), "git {args:?} failed: {}", String::from_utf8_lossy(&output.stderr));
    }
}
