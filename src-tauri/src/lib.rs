//! Argis backend — composition root. Wires OS adapters and providers into a
//! registry, polls it in the background and exposes it to the UI.

pub mod commands;
pub mod domain;
pub mod git_worktrees;
pub mod monitor;
pub mod project_paths;
pub mod providers;
pub mod shared;
pub mod system;
mod task_resume;
pub mod task_store;
pub mod terminal_manager;

#[cfg(test)]
mod git_worktrees_tests;

#[cfg(test)]
mod project_paths_tests;

#[cfg(test)]
mod task_store_tests;

#[cfg(test)]
mod terminal_manager_tests;

use monitor::{Monitor, Poller, ProviderRegistry};
use parking_lot::Mutex;
use providers::claude::ClaudeProvider;
use providers::codex::CodexProvider;
use providers::opencode::{ModelCatalog, OpenCodeProvider};
use providers::pi::PiProvider;
use providers::AgentProvider;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use system::{HomePaths, SysinfoProcessSource, SystemClock};
use task_resume::record_agent_session_references;
use task_store::TaskStoreState;
use tauri::{Emitter, Manager};
use terminal_manager::TerminalManager;

/// Event the UI listens on (`SNAPSHOT_EVENT` in `src/domain/types.ts`).
pub const SNAPSHOT_EVENT: &str = "agents://snapshot";
const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// The real registry: every provider over the given tool dirs, live
/// processes from `sysinfo`, wall-clock time.
pub fn build_registry(paths: &HomePaths) -> ProviderRegistry {
    let providers: Vec<Box<dyn AgentProvider>> = vec![
        Box::new(ClaudeProvider::new(paths.claude.clone())),
        Box::new(CodexProvider::new(paths.codex.clone())),
        Box::new(
            OpenCodeProvider::new(paths.opencode.clone())
                .with_models(ModelCatalog::from_file(paths.opencode_cache.join("models.json"))),
        ),
        Box::new(PiProvider::new(paths.pi.clone())),
    ];
    ProviderRegistry::new(providers, Box::new(SysinfoProcessSource::new()), Box::new(SystemClock))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Without a home dir every provider simply reports `available: false`.
    let paths = HomePaths::detect().unwrap_or_else(|_| HomePaths::from_home(Path::new("/nonexistent")));
    let monitor = Arc::new(Monitor::new(build_registry(&paths)));
    let poller_monitor = Arc::clone(&monitor);
    let terminal_manager = Arc::new(TerminalManager::default());
    let poller_terminal_manager = Arc::clone(&terminal_manager);
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(monitor)
        .manage(terminal_manager)
        .setup(move |app| {
            let task_store_path = app
                .path()
                .app_data_dir()
                .map(|directory| directory.join("argis.sqlite"))
                .map_err(|error| error.to_string());
            app.manage(TaskStoreState::from_path(task_store_path));

            let task_store_state = app.state::<TaskStoreState>().inner().clone();
            let handle = app.handle().clone();
            let observed_references = Mutex::new(HashSet::new());
            let poller = Poller::spawn(poller_monitor, POLL_INTERVAL, move |snapshot| {
                if let Ok(store) = task_store_state.store() {
                    let processes = poller_terminal_manager.running_agent_processes();
                    record_agent_session_references(snapshot, &processes, &store, &mut observed_references.lock());
                }
                let _ = handle.emit(SNAPSHOT_EVENT, snapshot);
            })?;
            app.manage(poller);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::refresh_snapshot,
            commands::open_path,
            commands::list_projects,
            commands::register_project,
            commands::list_tasks,
            commands::list_task_agent_resumes,
            commands::get_task_agent_resume,
            commands::save_task_agent_resume,
            commands::create_task,
            commands::update_task_details,
            commands::update_task_status,
            commands::delete_task,
            commands::inspect_task_git_status,
            commands::create_task_worktree,
            commands::start_terminal_session,
            commands::resume_task_agent,
            commands::reattach_terminal_session,
            commands::terminal_input,
            commands::resize_terminal_session,
            commands::detach_terminal_session,
            commands::list_terminal_inventory
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let terminal_manager = app_handle.state::<Arc<TerminalManager>>();
                if let Err(error) = terminal_manager.shutdown() {
                    eprintln!("failed to stop managed terminal processes: {error}");
                }
            }
        });
}
