use crate::domain::{
    TerminalAgent, TerminalAttachment, TerminalEvent, TerminalInventoryEntry, TerminalInventoryState,
    TerminalLifecycleEvent, TerminalSessionInfo, TerminalSessionKey, TerminalSize,
};
use anyhow::{anyhow, bail, Context};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
#[cfg(unix)]
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};

const OUTPUT_CHUNK_SIZE: usize = 8 * 1024;
const MAX_INPUT_SIZE: usize = 64 * 1024;
const MAX_COMMAND_ARGUMENTS: usize = 256;
const MAX_COMMAND_ARGUMENT_BYTES: usize = 8 * 1024;
const MAX_TERMINAL_DIMENSION: u16 = 1_000;
const OUTPUT_HISTORY_MAX_BYTES: usize = 1024 * 1024;
const TERMINAL_STOP_GRACE_PERIOD: Duration = Duration::from_millis(500);
const TERMINAL_STOP_POLL_INTERVAL: Duration = Duration::from_millis(10);

impl TerminalSize {
    fn validate(self) -> anyhow::Result<Self> {
        if self.cols == 0 || self.rows == 0 {
            bail!("terminal columns and rows must be greater than zero");
        }
        if self.cols > MAX_TERMINAL_DIMENSION || self.rows > MAX_TERMINAL_DIMENSION {
            bail!("terminal dimensions exceed the supported limit");
        }
        Ok(self)
    }

    fn into_pty_size(self) -> PtySize {
        PtySize { cols: self.cols, rows: self.rows, pixel_width: self.pixel_width, pixel_height: self.pixel_height }
    }
}

/// A process invocation with discrete arguments; `program` is never interpreted by a shell.
/// The command boundary must resolve `cwd` from the persisted task worktree, not from a UI path.
#[derive(Debug, Clone)]
pub struct TerminalProcessSpec {
    pub key: TerminalSessionKey,
    pub agent_cli: Option<TerminalAgent>,
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub size: TerminalSize,
}

/// Identity and task binding for an Agent PTY launched and owned by Argis.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ManagedAgentProcess {
    pub terminal_session_id: u64,
    pub task_id: i64,
    pub agent_cli: TerminalAgent,
    pub process_id: u32,
    pub started_at_ms: i64,
    pub cwd: PathBuf,
}

/// A callback used by Tauri Channels or by tests to receive ordered PTY events.
pub type TerminalEventSink = Arc<dyn Fn(TerminalEvent) -> Result<(), String> + Send + Sync + 'static>;
pub type TerminalLifecycleSink = Arc<dyn Fn(TerminalLifecycleEvent) + Send + Sync + 'static>;

#[derive(Default)]
struct ManagerState {
    shutting_down: bool,
    /// In-progress and deleted task IDs reject delayed starts and reattachments.
    closed_tasks: HashSet<i64>,
    by_id: HashMap<u64, Arc<ManagedSession>>,
    by_key: HashMap<TerminalSessionKey, u64>,
    failed_starts: HashMap<TerminalSessionKey, FailedTerminalStart>,
}

#[derive(Debug, Clone, Copy)]
struct FailedTerminalStart {
    key: TerminalSessionKey,
}

/// Owns interactive PTY processes for the lifetime of the Argis app.
pub struct TerminalManager {
    next_id: AtomicU64,
    state: Mutex<ManagerState>,
    lifecycle_sink: Option<TerminalLifecycleSink>,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self { next_id: AtomicU64::new(1), state: Mutex::new(ManagerState::default()), lifecycle_sink: None }
    }
}

struct ManagedSession {
    info: TerminalSessionInfo,
    started_at_ms: i64,
    cwd: PathBuf,
    lifecycle_sink: Option<TerminalLifecycleSink>,
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    child: Mutex<Option<Box<dyn Child + Send + Sync>>>,
    worker: Mutex<Option<JoinHandle<()>>>,
    running: AtomicBool,
    lifecycle: Mutex<SessionLifecycle>,
}

#[derive(Default)]
struct SessionLifecycle {
    sink_generation: u64,
    sink: Option<TerminalEventSink>,
    completed: Option<TerminalEvent>,
    output_history: TerminalOutputHistory,
    failed: bool,
}

#[derive(Default)]
struct TerminalOutputHistory {
    chunks: VecDeque<Vec<u8>>,
    bytes: usize,
}

impl TerminalOutputHistory {
    fn push(&mut self, bytes: &[u8]) {
        if bytes.is_empty() {
            return;
        }
        let bytes = if bytes.len() > OUTPUT_HISTORY_MAX_BYTES {
            &bytes[bytes.len() - OUTPUT_HISTORY_MAX_BYTES..]
        } else {
            bytes
        };
        while self.bytes + bytes.len() > OUTPUT_HISTORY_MAX_BYTES {
            let Some(oldest) = self.chunks.pop_front() else {
                break;
            };
            self.bytes -= oldest.len();
        }
        self.chunks.push_back(bytes.to_vec());
        self.bytes += bytes.len();
    }

    fn replay(&self, session_id: u64, sink: &TerminalEventSink) -> bool {
        self.chunks.iter().all(|bytes| sink(TerminalEvent::Output { session_id, bytes: bytes.clone() }).is_ok())
    }
}

impl TerminalManager {
    /// Creates a manager that publishes process exits independently of output-channel attachments.
    pub fn with_lifecycle_sink(lifecycle_sink: TerminalLifecycleSink) -> Self {
        Self {
            next_id: AtomicU64::new(1),
            state: Mutex::new(ManagerState::default()),
            lifecycle_sink: Some(lifecycle_sink),
        }
    }

    /// Starts a process in a PTY and subscribes `sink` before the PTY reader starts.
    pub fn start(&self, spec: TerminalProcessSpec, sink: TerminalEventSink) -> anyhow::Result<TerminalSessionInfo> {
        self.start_with_attachment(spec, sink).map(|attachment| attachment.session)
    }

    /// Starts a process and returns its first output-channel attachment generation.
    pub fn start_with_attachment(
        &self,
        spec: TerminalProcessSpec,
        sink: TerminalEventSink,
    ) -> anyhow::Result<TerminalAttachment> {
        self.start_internal(spec, sink, false)
    }

    /// Reuses the task/tab process when it is already running; otherwise it starts a new PTY.
    pub fn start_or_reattach_with_attachment(
        &self,
        spec: TerminalProcessSpec,
        sink: TerminalEventSink,
    ) -> anyhow::Result<TerminalAttachment> {
        self.start_internal(spec, sink, true)
    }

    fn start_internal(
        &self,
        spec: TerminalProcessSpec,
        sink: TerminalEventSink,
        reuse_existing: bool,
    ) -> anyhow::Result<TerminalAttachment> {
        let cwd = validate_process_spec(&spec)?;
        let mut manager = self.state.lock();
        if manager.shutting_down {
            bail!("terminal manager is shutting down");
        }
        if manager.closed_tasks.contains(&spec.key.task_id) {
            bail!("task terminal sessions are being deleted or the task has been deleted");
        }
        if let Some(existing_id) = manager.by_key.get(&spec.key).copied() {
            if let Some(session) = manager.by_id.get(&existing_id) {
                if session.running.load(Ordering::Acquire) {
                    if !reuse_existing {
                        bail!("a terminal process is already running for this task tab");
                    }
                    if session.info.agent_cli != spec.agent_cli {
                        bail!("task tab already has a running process for a different agent CLI");
                    }
                    let attachment_id = session.attach(sink);
                    return Ok(TerminalAttachment { session: session.info(), attachment_id });
                }
            }
            manager.by_id.remove(&existing_id);
            manager.by_key.remove(&spec.key);
        }
        manager.failed_starts.remove(&spec.key);

        let id = self
            .next_id
            .try_update(Ordering::Relaxed, Ordering::Relaxed, |current| current.checked_add(1))
            .map_err(|_| anyhow!("terminal session identifier space is exhausted"))?;

        let pty_system = native_pty_system();
        let pair = match pty_system.openpty(spec.size.validate()?.into_pty_size()) {
            Ok(pair) => pair,
            Err(error) => {
                manager.failed_starts.insert(spec.key, FailedTerminalStart { key: spec.key });
                return Err(error).context("opening PTY");
            }
        };
        let reader = match pair.master.try_clone_reader() {
            Ok(reader) => reader,
            Err(error) => {
                manager.failed_starts.insert(spec.key, FailedTerminalStart { key: spec.key });
                return Err(error).context("opening PTY output reader");
            }
        };
        let writer = match pair.master.take_writer() {
            Ok(writer) => writer,
            Err(error) => {
                manager.failed_starts.insert(spec.key, FailedTerminalStart { key: spec.key });
                return Err(error).context("opening PTY input writer");
            }
        };
        let started_at_ms = crate::system::clock::system_time_ms(SystemTime::now());
        let mut command = CommandBuilder::new(&spec.program);
        command.args(&spec.args);
        command.cwd(&cwd);
        let child = match pair.slave.spawn_command(command) {
            Ok(child) => child,
            Err(error) => {
                manager.failed_starts.insert(spec.key, FailedTerminalStart { key: spec.key });
                return Err(error).with_context(|| format!("starting {}", spec.program.display()));
            }
        };
        let process_id = child.process_id();
        let killer = child.clone_killer();

        let session = Arc::new(ManagedSession {
            info: TerminalSessionInfo { id, key: spec.key, agent_cli: spec.agent_cli, process_id, running: true },
            started_at_ms,
            cwd,
            lifecycle_sink: self.lifecycle_sink.clone(),
            master: Mutex::new(Some(pair.master)),
            writer: Mutex::new(writer),
            killer: Mutex::new(killer),
            child: Mutex::new(Some(child)),
            worker: Mutex::new(None),
            running: AtomicBool::new(true),
            lifecycle: Mutex::new(SessionLifecycle {
                sink_generation: 1,
                sink: Some(sink),
                completed: None,
                output_history: TerminalOutputHistory::default(),
                failed: false,
            }),
        });

        let worker_session = Arc::clone(&session);
        let worker = match thread::Builder::new()
            .name(format!("argis-terminal-{id}"))
            .spawn(move || stream_pty_output(worker_session, reader))
        {
            Ok(worker) => worker,
            Err(error) => {
                terminate_unstarted_session(&session);
                manager.failed_starts.insert(spec.key, FailedTerminalStart { key: spec.key });
                return Err(error).context("starting terminal output worker");
            }
        };
        *session.worker.lock() = Some(worker);

        manager.by_key.insert(spec.key, id);
        manager.by_id.insert(id, Arc::clone(&session));
        Ok(TerminalAttachment { session: session.info(), attachment_id: 1 })
    }

    /// Replaces the PTY event sink for a live session without starting a new process.
    pub fn reattach(&self, key: TerminalSessionKey, sink: TerminalEventSink) -> anyhow::Result<TerminalSessionInfo> {
        self.reattach_with_attachment(key, sink).map(|attachment| attachment.session)
    }

    /// Replaces an output sink and returns an attachment token for safe later detachment.
    pub fn reattach_with_attachment(
        &self,
        key: TerminalSessionKey,
        sink: TerminalEventSink,
    ) -> anyhow::Result<TerminalAttachment> {
        self.reattach_if_present_with_attachment(key, sink)
            .ok_or_else(|| anyhow!("no terminal session exists for this task tab"))
    }

    /// Reattaches when a process record exists; a missing task tab is not an error.
    pub fn reattach_if_present(&self, key: TerminalSessionKey, sink: TerminalEventSink) -> Option<TerminalSessionInfo> {
        self.reattach_if_present_with_attachment(key, sink).map(|attachment| attachment.session)
    }

    /// Reattaches when present and returns a token that prevents stale detach calls from affecting newer channels.
    pub fn reattach_if_present_with_attachment(
        &self,
        key: TerminalSessionKey,
        sink: TerminalEventSink,
    ) -> Option<TerminalAttachment> {
        let manager = self.state.lock();
        if manager.closed_tasks.contains(&key.task_id) {
            return None;
        }
        let id = manager.by_key.get(&key)?;
        let session = manager.by_id.get(id)?;
        let attachment_id = session.attach(sink);
        Some(TerminalAttachment { session: session.info(), attachment_id })
    }

    /// Detaches only the matching channel generation, leaving a newer reattachment intact.
    pub fn detach_attachment(&self, key: TerminalSessionKey, attachment_id: u64) -> bool {
        let session = {
            let manager = self.state.lock();
            let Some(id) = manager.by_key.get(&key) else {
                return false;
            };
            let Some(session) = manager.by_id.get(id) else {
                return false;
            };
            Arc::clone(session)
        };
        session.detach_if_generation(attachment_id)
    }

    /// Writes a bounded input chunk to an active PTY.
    pub fn input(&self, id: u64, bytes: &[u8]) -> anyhow::Result<()> {
        if bytes.len() > MAX_INPUT_SIZE {
            bail!("terminal input exceeds the {} byte limit", MAX_INPUT_SIZE);
        }
        let session = self.session(id)?;
        session.ensure_running()?;
        let mut writer = session.writer.lock();
        writer.write_all(bytes).context("writing terminal input")?;
        writer.flush().context("flushing terminal input")
    }

    /// Resizes an active PTY after validating its character-cell dimensions.
    pub fn resize(&self, id: u64, size: TerminalSize) -> anyhow::Result<()> {
        let size = size.validate()?;
        let session = self.session(id)?;
        session.ensure_running()?;
        let master = session.master.lock();
        master
            .as_ref()
            .ok_or_else(|| anyhow!("terminal PTY is closed"))?
            .resize(size.into_pty_size())
            .context("resizing PTY")
    }

    /// Stops, waits for, and removes a PTY process. Calling it more than once is safe.
    pub fn stop(&self, id: u64) -> anyhow::Result<()> {
        let session = {
            let mut manager = self.state.lock();
            let Some(session) = manager.by_id.remove(&id) else {
                return Ok(());
            };
            manager.by_key.remove(&session.info.key);
            manager.failed_starts.remove(&session.info.key);
            session
        };
        session.stop()
    }

    /// Stops and reaps every terminal for a task, preventing new sessions until deletion finishes.
    pub fn stop_task_sessions(&self, task_id: i64) -> anyhow::Result<()> {
        if task_id <= 0 {
            bail!("task ID must be positive");
        }

        let sessions = {
            let mut manager = self.state.lock();
            if manager.shutting_down {
                bail!("terminal manager is shutting down");
            }
            if !manager.closed_tasks.insert(task_id) {
                bail!("task terminal sessions are already being deleted");
            }
            manager.failed_starts.retain(|key, _| key.task_id != task_id);
            manager
                .by_key
                .iter()
                .filter(|(key, _)| key.task_id == task_id)
                .filter_map(|(_, id)| manager.by_id.get(id).cloned())
                .collect::<Vec<_>>()
        };

        let mut stopped = Vec::with_capacity(sessions.len());
        let mut failures = Vec::new();
        for session in sessions {
            match session.stop() {
                Ok(()) => stopped.push((session.info.id, session.info.key)),
                Err(error) => failures.push(error.to_string()),
            }
        }

        let mut manager = self.state.lock();
        for (id, key) in stopped {
            manager.by_id.remove(&id);
            if manager.by_key.get(&key) == Some(&id) {
                manager.by_key.remove(&key);
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            manager.closed_tasks.remove(&task_id);
            bail!("failed to stop task terminal sessions: {}", failures.join("; "));
        }
    }

    /// Releases the deletion barrier on failure; successful IDs remain tombstoned for this app lifetime.
    pub fn finish_task_deletion(&self, task_id: i64, task_deleted: bool) {
        if !task_deleted {
            self.state.lock().closed_tasks.remove(&task_id);
        }
    }

    /// Stops and reaps every session. The manager cannot be restarted afterward.
    pub fn shutdown(&self) -> anyhow::Result<()> {
        let sessions = {
            let mut manager = self.state.lock();
            manager.shutting_down = true;
            manager.by_key.clear();
            manager.failed_starts.clear();
            manager.by_id.drain().map(|(_, session)| session).collect::<Vec<_>>()
        };

        let mut failures = Vec::new();
        for session in sessions {
            if let Err(error) = session.stop() {
                failures.push(error.to_string());
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            bail!("failed to stop terminal sessions: {}", failures.join("; "));
        }
    }

    /// Number of child processes that have not yet exited.
    pub fn active_session_count(&self) -> usize {
        self.state.lock().by_id.values().filter(|session| session.running.load(Ordering::Acquire)).count()
    }

    /// Returns task/tab lifecycle for PTYs currently or previously owned by Argis in this app session.
    pub fn inventory(&self) -> Vec<TerminalInventoryEntry> {
        let mut entries = {
            let manager = self.state.lock();
            let mut entries = manager.by_id.values().map(|session| session.inventory_entry()).collect::<Vec<_>>();
            entries.extend(manager.failed_starts.values().map(|failed| TerminalInventoryEntry {
                task_id: failed.key.task_id,
                tab: failed.key.tab,
                state: TerminalInventoryState::Failed,
            }));
            entries
        };
        entries.sort_by_key(|entry| {
            (entry.task_id, matches!(entry.tab, crate::domain::TerminalTab::Term), state_rank(entry.state))
        });
        entries
    }

    /// Returns only live Agent PTYs that Argis launched, bound to their task and canonical cwd.
    pub(crate) fn running_agent_processes(&self) -> Vec<ManagedAgentProcess> {
        self.state
            .lock()
            .by_id
            .values()
            .filter_map(|session| {
                let info = session.info();
                if !info.running || info.key.tab != crate::domain::TerminalTab::Agent {
                    return None;
                }
                Some(ManagedAgentProcess {
                    terminal_session_id: info.id,
                    task_id: info.key.task_id,
                    agent_cli: info.agent_cli?,
                    process_id: info.process_id?,
                    started_at_ms: session.started_at_ms,
                    cwd: session.cwd.clone(),
                })
            })
            .collect()
    }

    fn session(&self, id: u64) -> anyhow::Result<Arc<ManagedSession>> {
        let manager = self.state.lock();
        let session = manager.by_id.get(&id).cloned().ok_or_else(|| anyhow!("terminal session {id} does not exist"))?;
        if manager.closed_tasks.contains(&session.info.key.task_id) {
            bail!("task terminal sessions are being deleted or the task has been deleted");
        }
        Ok(session)
    }
}

impl Drop for TerminalManager {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}

impl ManagedSession {
    fn info(&self) -> TerminalSessionInfo {
        TerminalSessionInfo { running: self.running.load(Ordering::Acquire), ..self.info }
    }

    fn ensure_running(&self) -> anyhow::Result<()> {
        if self.running.load(Ordering::Acquire) {
            Ok(())
        } else {
            bail!("terminal session has exited");
        }
    }

    fn inventory_entry(&self) -> TerminalInventoryEntry {
        let lifecycle = self.lifecycle.lock();
        let state = if self.running.load(Ordering::Acquire) {
            TerminalInventoryState::Running
        } else if lifecycle.failed {
            TerminalInventoryState::Failed
        } else {
            TerminalInventoryState::Completed
        };
        TerminalInventoryEntry { task_id: self.info.key.task_id, tab: self.info.key.tab, state }
    }

    fn attach(&self, sink: TerminalEventSink) -> u64 {
        let mut lifecycle = self.lifecycle.lock();
        lifecycle.sink_generation = lifecycle.sink_generation.wrapping_add(1).max(1);
        if !lifecycle.output_history.replay(self.info.id, &sink) {
            lifecycle.sink = None;
            return lifecycle.sink_generation;
        }
        if let Some(completed) = lifecycle.completed.clone() {
            if sink(completed).is_err() {
                lifecycle.sink = None;
                return lifecycle.sink_generation;
            }
        }
        lifecycle.sink = Some(sink);
        lifecycle.sink_generation
    }

    fn detach_if_generation(&self, generation: u64) -> bool {
        let mut lifecycle = self.lifecycle.lock();
        if lifecycle.sink_generation != generation || lifecycle.sink.is_none() {
            return false;
        }
        lifecycle.sink = None;
        true
    }

    fn emit(&self, event: TerminalEvent) {
        let mut lifecycle = self.lifecycle.lock();
        if let TerminalEvent::Output { bytes, .. } = &event {
            lifecycle.output_history.push(bytes);
        }
        if lifecycle.sink.as_ref().is_some_and(|sink| sink(event).is_err()) {
            lifecycle.sink = None;
        }
    }

    fn finish(&self, exit_code: u32, signal: Option<String>) {
        if !self.running.swap(false, Ordering::AcqRel) {
            return;
        }
        let event = TerminalEvent::Exited { session_id: self.info.id, exit_code, signal: signal.clone() };
        {
            let mut lifecycle = self.lifecycle.lock();
            lifecycle.failed = false;
            lifecycle.completed = Some(event.clone());
            if lifecycle.sink.as_ref().is_some_and(|sink| sink(event).is_err()) {
                lifecycle.sink = None;
            }
        }
        if let Some(sink) = &self.lifecycle_sink {
            sink(TerminalLifecycleEvent {
                task_id: self.info.key.task_id,
                tab: self.info.key.tab,
                agent_cli: self.info.agent_cli,
                session_id: self.info.id,
                exit_code,
                signal,
            });
        }
    }

    fn finish_with_error(&self, message: String) {
        self.running.store(false, Ordering::Release);
        let mut lifecycle = self.lifecycle.lock();
        lifecycle.failed = true;
        let event = TerminalEvent::Error { session_id: self.info.id, message };
        lifecycle.completed = Some(event.clone());
        if lifecycle.sink.as_ref().is_some_and(|sink| sink(event).is_err()) {
            lifecycle.sink = None;
        }
    }

    fn stop(&self) -> anyhow::Result<()> {
        if self.running.load(Ordering::Acquire) {
            // Deliver Ctrl-C through the PTY and a direct interrupt so noninteractive CLIs can exit cleanly too.
            let mut writer = self.writer.lock();
            let _ = writer.write_all(&[0x03]);
            let _ = writer.flush();
            drop(writer);
            interrupt_child(self.info.process_id);

            let deadline = Instant::now() + TERMINAL_STOP_GRACE_PERIOD;
            while self.running.load(Ordering::Acquire) && Instant::now() < deadline {
                thread::sleep(TERMINAL_STOP_POLL_INTERVAL);
            }

            let kill_error = if self.running.load(Ordering::Acquire) { self.killer.lock().kill().err() } else { None };
            let worker = self.worker.lock().take();
            if let Some(worker) = worker {
                worker.join().map_err(|_| anyhow!("terminal output worker panicked"))?;
            }
            if self.running.load(Ordering::Acquire) {
                return Err(kill_error
                    .map(anyhow::Error::msg)
                    .unwrap_or_else(|| anyhow!("terminal process did not stop")));
            }
        } else if let Some(worker) = self.worker.lock().take() {
            worker.join().map_err(|_| anyhow!("terminal output worker panicked"))?;
        }

        self.lifecycle.lock().sink = None;
        self.master.lock().take();
        Ok(())
    }
}

#[cfg(unix)]
fn interrupt_child(process_id: Option<u32>) {
    let Some(process_id) = process_id else { return };
    let _ = Command::new("/bin/kill")
        .args(["-INT", &process_id.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(not(unix))]
fn interrupt_child(_process_id: Option<u32>) {}

fn state_rank(state: TerminalInventoryState) -> u8 {
    match state {
        TerminalInventoryState::Running => 0,
        TerminalInventoryState::Completed => 1,
        TerminalInventoryState::Failed => 2,
    }
}

impl Drop for ManagedSession {
    fn drop(&mut self) {
        if self.running.load(Ordering::Acquire) {
            let _ = self.killer.get_mut().kill();
        }
    }
}

fn validate_process_spec(spec: &TerminalProcessSpec) -> anyhow::Result<PathBuf> {
    if spec.key.task_id <= 0 {
        bail!("task ID must be positive");
    }
    if spec.program.as_os_str().is_empty() {
        bail!("terminal program must not be empty");
    }
    if spec.args.len() > MAX_COMMAND_ARGUMENTS {
        bail!("terminal command has too many arguments");
    }
    if spec.args.iter().any(|argument| argument.len() > MAX_COMMAND_ARGUMENT_BYTES) {
        bail!("terminal command argument exceeds the {} byte limit", MAX_COMMAND_ARGUMENT_BYTES);
    }
    spec.size.validate()?;
    if !spec.cwd.is_absolute() {
        bail!("terminal working directory must be an absolute path");
    }

    let cwd =
        fs::canonicalize(&spec.cwd).with_context(|| format!("resolving working directory {}", spec.cwd.display()))?;
    if !cwd.is_dir() {
        bail!("terminal working directory is not a directory: {}", cwd.display());
    }
    Ok(cwd)
}

fn stream_pty_output(session: Arc<ManagedSession>, mut reader: Box<dyn Read + Send>) {
    let Some(mut child) = session.child.lock().take() else {
        session.finish_with_error("terminal child handle is unavailable".to_owned());
        return;
    };

    let mut buffer = [0_u8; OUTPUT_CHUNK_SIZE];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read) => {
                session.emit(TerminalEvent::Output { session_id: session.info.id, bytes: buffer[..read].to_vec() })
            }
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) if is_pty_closed(&error) => break,
            Err(error) => {
                session.emit(TerminalEvent::Error { session_id: session.info.id, message: error.to_string() });
                break;
            }
        }
    }

    let exit = child.wait();
    match exit {
        Ok(exit) => {
            let exit_code = exit.exit_code();
            let signal = exit.signal().map(str::to_owned);
            session.finish(exit_code, signal);
        }
        Err(error) => session.finish_with_error(error.to_string()),
    }
}

fn is_pty_closed(error: &std::io::Error) -> bool {
    if matches!(error.kind(), std::io::ErrorKind::BrokenPipe | std::io::ErrorKind::UnexpectedEof) {
        return true;
    }
    #[cfg(unix)]
    {
        // PTY masters commonly report EIO after the slave side closes (POSIX errno 5).
        error.raw_os_error() == Some(5)
    }
    #[cfg(not(unix))]
    {
        false
    }
}

fn terminate_unstarted_session(session: &ManagedSession) {
    let _ = session.killer.lock().kill();
    if let Some(mut child) = session.child.lock().take() {
        let _ = child.wait();
    }
}
