//! Argis backend — composition root. Wires OS adapters and providers into a
//! registry, polls it in the background and exposes it to the UI.

pub mod commands;
pub mod domain;
pub mod monitor;
pub mod providers;
pub mod shared;
pub mod system;

use monitor::{Monitor, Poller, ProviderRegistry};
use providers::claude::ClaudeProvider;
use providers::codex::CodexProvider;
use providers::opencode::{ModelCatalog, OpenCodeProvider};
use providers::pi::PiProvider;
use providers::AgentProvider;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use system::{HomePaths, SysinfoProcessSource, SystemClock};
use tauri::{Emitter, Manager};

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(monitor)
        .setup(move |app| {
            let handle = app.handle().clone();
            let poller = Poller::spawn(poller_monitor, POLL_INTERVAL, move |snapshot| {
                let _ = handle.emit(SNAPSHOT_EVENT, snapshot);
            })?;
            app.manage(poller);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::refresh_snapshot,
            commands::open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
