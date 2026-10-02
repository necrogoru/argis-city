use super::{ProcessInfo, ProcessSource};
use parking_lot::Mutex;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

/// `ProcessSource` backed by `sysinfo`. Keeps one `System` alive between
/// polls so refreshes are incremental.
pub struct SysinfoProcessSource {
    system: Mutex<System>,
}

impl SysinfoProcessSource {
    pub fn new() -> Self {
        Self { system: Mutex::new(System::new()) }
    }
}

impl Default for SysinfoProcessSource {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessSource for SysinfoProcessSource {
    fn snapshot(&self) -> Vec<ProcessInfo> {
        let mut system = self.system.lock();
        // cwd changes over a process' life, so refresh it every time; the
        // command line is fixed once set.
        let kind = ProcessRefreshKind::nothing().with_cmd(UpdateKind::OnlyIfNotSet).with_cwd(UpdateKind::Always);
        system.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
        system
            .processes()
            .values()
            .filter(|p| p.thread_kind().is_none())
            .map(|p| ProcessInfo {
                pid: p.pid().as_u32(),
                parent_pid: p.parent().map(|pp| pp.as_u32()),
                name: p.name().to_string_lossy().into_owned(),
                cmd: p.cmd().iter().map(|a| a.to_string_lossy().into_owned()).collect(),
                cwd: p.cwd().map(|c| c.to_path_buf()),
                started_at_ms: p.start_time() as i64 * 1000,
            })
            .collect()
    }
}
