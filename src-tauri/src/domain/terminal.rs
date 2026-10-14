use serde::{Deserialize, Serialize};

/// The two task-scoped PTY slots managed by Argis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalTab {
    Agent,
    Term,
}

/// Allowlisted coding-agent CLI choices exposed in the task terminal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TerminalAgent {
    Claude,
    Codex,
    OpenCode,
    Pi,
}

impl TerminalAgent {
    /// Executable name resolved through the app's inherited PATH.
    pub const fn executable(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::OpenCode => "opencode",
            Self::Pi => "pi",
        }
    }
}

/// The identity of a terminal slot. A task has at most one process per tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionKey {
    pub task_id: i64,
    pub tab: TerminalTab,
}

/// A terminal size, in character cells and optional pixel dimensions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
    pub pixel_width: u16,
    pub pixel_height: u16,
}

impl Default for TerminalSize {
    fn default() -> Self {
        Self { cols: 80, rows: 24, pixel_width: 0, pixel_height: 0 }
    }
}

/// PTY data delivered to the frontend Channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum TerminalEvent {
    Output { session_id: u64, bytes: Vec<u8> },
    Error { session_id: u64, message: String },
    Exited { session_id: u64, exit_code: u32, signal: Option<String> },
}

/// Public process information; no PTY handles or child-process controls cross IPC.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    pub id: u64,
    pub key: TerminalSessionKey,
    pub agent_cli: Option<TerminalAgent>,
    pub process_id: Option<u32>,
    pub running: bool,
}

/// Session data plus the generation of its current output-channel attachment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAttachment {
    pub session: TerminalSessionInfo,
    pub attachment_id: u64,
}
