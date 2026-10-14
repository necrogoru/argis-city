use crate::domain::{TerminalAgent, TerminalEvent, TerminalSessionKey, TerminalSize, TerminalTab};
use crate::terminal_manager::{TerminalEventSink, TerminalManager, TerminalProcessSpec};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::time::{Duration, Instant};

fn key(task_id: i64, tab: TerminalTab) -> TerminalSessionKey {
    TerminalSessionKey { task_id, tab }
}

#[test]
fn terminal_events_use_camel_case_fields_for_the_channel_contract() {
    let event = TerminalEvent::Output { session_id: 7, bytes: vec![0, 65, 255] };

    assert_eq!(
        serde_json::to_value(event).unwrap(),
        serde_json::json!({ "type": "output", "sessionId": 7, "bytes": [0, 65, 255] })
    );
}

#[test]
fn terminal_agent_choices_map_to_fixed_executable_names() {
    assert_eq!(TerminalAgent::Claude.executable(), "claude");
    assert_eq!(TerminalAgent::Codex.executable(), "codex");
    assert_eq!(TerminalAgent::OpenCode.executable(), "opencode");
    assert_eq!(TerminalAgent::Pi.executable(), "pi");
}

#[test]
fn terminal_size_accepts_webview_character_dimensions_without_pixel_fields() {
    let size: TerminalSize = serde_json::from_value(serde_json::json!({ "cols": 100, "rows": 40 })).unwrap();

    assert_eq!(size, TerminalSize { cols: 100, rows: 40, pixel_width: 0, pixel_height: 0 });
}

fn spec(task_id: i64, tab: TerminalTab, program: &str, args: &[&str]) -> TerminalProcessSpec {
    TerminalProcessSpec {
        key: key(task_id, tab),
        agent_cli: None,
        program: PathBuf::from(program),
        args: args.iter().map(|arg| (*arg).to_owned()).collect(),
        cwd: PathBuf::from(env!("CARGO_MANIFEST_DIR")),
        size: TerminalSize::default(),
    }
}

#[cfg(unix)]
#[test]
fn detached_terminal_keeps_running_and_receives_output_after_reattachment() {
    let manager = TerminalManager::default();
    let (first_sender, first_events) = mpsc::channel();
    let command = spec(
        47,
        TerminalTab::Term,
        "/bin/sh",
        &["-c", "printf 'READY\\n'; while IFS= read -r line; do printf 'RECEIVED:%s\\n' \"$line\"; done"],
    );
    let initial_attachment = manager.start_with_attachment(command, sink(first_sender)).unwrap();
    let session = initial_attachment.session;
    assert!(output_until(&first_events, "READY").contains("READY"));

    assert!(manager.detach_attachment(key(47, TerminalTab::Term), initial_attachment.attachment_id));
    manager.input(session.id, b"discard-while-detached\n").unwrap();
    let (reattached_sender, reattached_events) = mpsc::channel();
    let reattached =
        manager.reattach_if_present_with_attachment(key(47, TerminalTab::Term), sink(reattached_sender)).unwrap();

    assert_eq!(reattached.session.id, session.id);
    assert!(reattached.session.running);
    assert!(!manager.detach_attachment(key(47, TerminalTab::Term), initial_attachment.attachment_id));
    manager.input(session.id, b"visible-after-reattach\n").unwrap();
    assert!(
        output_until(&reattached_events, "RECEIVED:visible-after-reattach").contains("RECEIVED:visible-after-reattach")
    );
    assert!(manager.detach_attachment(key(47, TerminalTab::Term), reattached.attachment_id));
    manager.stop(session.id).unwrap();
}

#[test]
fn reattach_if_present_returns_none_without_creating_a_process() {
    let manager = TerminalManager::default();
    let (sender, _events) = mpsc::channel();

    assert!(manager.reattach_if_present(key(48, TerminalTab::Agent), sink(sender)).is_none());
    assert_eq!(manager.active_session_count(), 0);
}

fn sink(sender: Sender<TerminalEvent>) -> TerminalEventSink {
    Arc::new(move |event| sender.send(event).map_err(|error| error.to_string()))
}

fn output_until(receiver: &Receiver<TerminalEvent>, needle: &str) -> String {
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut output = String::new();
    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        match receiver.recv_timeout(remaining) {
            Ok(TerminalEvent::Output { bytes, .. }) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
                if output.contains(needle) {
                    return output;
                }
            }
            Ok(TerminalEvent::Error { message, .. }) => panic!("terminal emitted an error: {message}"),
            Ok(TerminalEvent::Exited { exit_code, signal, .. }) => {
                panic!("terminal exited before {needle:?}: code={exit_code}, signal={signal:?}");
            }
            Err(error) => panic!("timed out waiting for {needle:?}: {error}; output={output:?}"),
        }
    }
    panic!("timed out waiting for {needle:?}; output={output:?}");
}

fn wait_for_exit(receiver: &Receiver<TerminalEvent>, session_id: u64) -> (u32, Option<String>) {
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        match receiver.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok(TerminalEvent::Exited { session_id: event_session, exit_code, signal })
                if event_session == session_id =>
            {
                return (exit_code, signal);
            }
            Ok(TerminalEvent::Output { .. }) => {}
            Ok(TerminalEvent::Error { message, .. }) => panic!("terminal emitted an error before exit: {message}"),
            Ok(TerminalEvent::Exited { .. }) => panic!("received exit event for a different session"),
            Err(error) => panic!("timed out waiting for session exit: {error}"),
        }
    }
    panic!("timed out waiting for session {session_id} to exit");
}

#[cfg(unix)]
#[test]
fn terminal_manager_supports_interactive_io_resize_reattach_and_stop() {
    let manager = TerminalManager::default();
    let (first_sender, first_events) = mpsc::channel();
    let mut command = spec(
        41,
        TerminalTab::Term,
        "/bin/sh",
        &["-c", "printf 'READY\\n'; IFS= read -r line; printf 'RECEIVED:%s\\n' \"$line\"; sleep 30"],
    );
    command.size = TerminalSize { cols: 90, rows: 30, pixel_width: 900, pixel_height: 600 };

    let session = manager.start(command, sink(first_sender)).unwrap();

    assert_eq!(session.key, key(41, TerminalTab::Term));
    assert!(session.running);
    assert!(output_until(&first_events, "READY").contains("READY"));
    manager.resize(session.id, TerminalSize { cols: 110, rows: 36, pixel_width: 1100, pixel_height: 720 }).unwrap();

    let (reattached_sender, reattached_events) = mpsc::channel();
    let reattached = manager.reattach(key(41, TerminalTab::Term), sink(reattached_sender)).unwrap();
    assert_eq!(reattached.id, session.id);
    manager.input(session.id, b"keep-going\n").unwrap();
    assert!(output_until(&reattached_events, "RECEIVED:keep-going").contains("RECEIVED:keep-going"));

    manager.stop(session.id).unwrap();
    wait_for_exit(&reattached_events, session.id);
    assert_eq!(manager.active_session_count(), 0);
}

#[cfg(unix)]
#[test]
fn terminal_manager_rejects_duplicate_tab_sessions_and_invalid_input() {
    let manager = TerminalManager::default();
    let (sender, _events) = mpsc::channel();
    let session = manager.start(spec(42, TerminalTab::Agent, "/bin/sleep", &["30"]), sink(sender)).unwrap();

    assert!(manager.start(spec(42, TerminalTab::Agent, "/bin/sleep", &["30"]), sink(mpsc::channel().0)).is_err());
    assert!(manager.input(session.id, &vec![b'x'; 65_537]).is_err());
    assert!(manager.resize(session.id, TerminalSize { cols: 0, rows: 24, pixel_width: 0, pixel_height: 0 }).is_err());
    manager.stop(session.id).unwrap();
}

#[cfg(unix)]
#[test]
fn start_or_reattach_reuses_a_running_session_only_for_the_same_agent() {
    let manager = TerminalManager::default();
    let (first_sender, _first_events) = mpsc::channel();
    let mut first_spec = spec(50, TerminalTab::Agent, "/bin/sleep", &["30"]);
    first_spec.agent_cli = Some(TerminalAgent::Codex);
    let first = manager.start_with_attachment(first_spec, sink(first_sender)).unwrap();

    let (second_sender, _second_events) = mpsc::channel();
    let mut same_cli = spec(50, TerminalTab::Agent, "/not/needed/for/an/existing/session", &[]);
    same_cli.agent_cli = Some(TerminalAgent::Codex);
    let attached = manager.start_or_reattach_with_attachment(same_cli, sink(second_sender)).unwrap();
    assert_eq!(attached.session.id, first.session.id);
    assert_ne!(attached.attachment_id, first.attachment_id);

    let (wrong_sender, _wrong_events) = mpsc::channel();
    let mut different_cli = spec(50, TerminalTab::Agent, "/bin/sleep", &["30"]);
    different_cli.agent_cli = Some(TerminalAgent::Claude);
    assert!(manager.start_or_reattach_with_attachment(different_cli, sink(wrong_sender)).is_err());
    assert!(!manager.detach_attachment(key(50, TerminalTab::Agent), first.attachment_id));
    assert!(manager.detach_attachment(key(50, TerminalTab::Agent), attached.attachment_id));
    manager.stop(first.session.id).unwrap();
}

#[cfg(unix)]
#[test]
fn terminal_manager_reaps_all_sessions_on_shutdown_and_is_idempotent() {
    let manager = TerminalManager::default();
    let (first_sender, first_events) = mpsc::channel();
    let (second_sender, second_events) = mpsc::channel();
    let first_session = manager.start(spec(43, TerminalTab::Agent, "/bin/sleep", &["30"]), sink(first_sender)).unwrap();
    let second_session =
        manager.start(spec(43, TerminalTab::Term, "/bin/sleep", &["30"]), sink(second_sender)).unwrap();

    manager.shutdown().unwrap();
    manager.shutdown().unwrap();

    wait_for_exit(&first_events, first_session.id);
    wait_for_exit(&second_events, second_session.id);
    assert_eq!(manager.active_session_count(), 0);
}

#[cfg(unix)]
#[test]
fn terminal_manager_reports_launch_errors_without_reserving_the_task_tab() {
    let manager = TerminalManager::default();
    let (sender, _events) = mpsc::channel();
    let invalid = spec(45, TerminalTab::Agent, "/definitely/not/an/executable", &[]);

    assert!(manager.start(invalid, sink(sender)).is_err());
    assert_eq!(manager.active_session_count(), 0);

    let (sender, shell_events) = mpsc::channel();
    let shell = spec(
        45,
        TerminalTab::Term,
        "/bin/sh",
        &["-c", "printf 'SHELL_READY\\n'; IFS= read -r line; printf 'SHELL_RECEIVED:%s\\n' \"$line\""],
    );
    let shell = manager.start(shell, sink(sender)).unwrap();

    assert!(output_until(&shell_events, "SHELL_READY").contains("SHELL_READY"));
    manager.input(shell.id, b"still-usable\n").unwrap();
    assert!(output_until(&shell_events, "SHELL_RECEIVED:still-usable").contains("SHELL_RECEIVED:still-usable"));
    manager.shutdown().unwrap();
}

#[cfg(unix)]
#[test]
fn terminal_manager_reattaches_to_a_completed_session_and_replays_exit_status() {
    let manager = TerminalManager::default();
    let (first_sender, first_events) = mpsc::channel();
    let session = manager
        .start(spec(46, TerminalTab::Agent, "/bin/sh", &["-c", "printf 'finished\\n'; exit 7"]), sink(first_sender))
        .unwrap();

    assert!(output_until(&first_events, "finished").contains("finished"));
    assert_eq!(wait_for_exit(&first_events, session.id), (7, None));
    assert_eq!(manager.active_session_count(), 0);

    let (reattached_sender, reattached_events) = mpsc::channel();
    let completed = manager.reattach(key(46, TerminalTab::Agent), sink(reattached_sender)).unwrap();

    assert_eq!(completed.id, session.id);
    assert!(!completed.running);
    assert_eq!(wait_for_exit(&reattached_events, session.id), (7, None));
    manager.stop(session.id).unwrap();
}

#[cfg(unix)]
#[test]
fn terminal_manager_rejects_nonexistent_working_directories_before_starting() {
    let manager = TerminalManager::default();
    let (sender, _events) = mpsc::channel();
    let mut command = spec(44, TerminalTab::Term, "/bin/sleep", &["30"]);
    command.cwd = PathBuf::from("/definitely/not/a/project");

    assert!(manager.start(command, sink(sender)).is_err());
    assert_eq!(manager.active_session_count(), 0);

    let (sender, _events) = mpsc::channel();
    let mut relative = spec(44, TerminalTab::Term, "/bin/sleep", &["30"]);
    relative.cwd = PathBuf::from(".");

    assert!(manager.start(relative, sink(sender)).is_err());
    assert_eq!(manager.active_session_count(), 0);
}
