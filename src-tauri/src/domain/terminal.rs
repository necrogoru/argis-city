use serde::de::{self, Deserializer};
use serde::{Deserialize, Serialize, Serializer};

/// Shell slots a task terminal can own, including the base `term` slot.
pub const MAX_SHELL_TABS: u8 = 6;

/// A task-scoped PTY slot: the fixed Agent tab or a numbered shell.
///
/// Shell slot 1 is the original `term` tab; slots 2..=MAX_SHELL_TABS are extra
/// shells. The wire id is `agent`, `term`, or `term-<slot>`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TerminalTab {
    Agent,
    Shell(u8),
}

impl TerminalTab {
    pub const fn shell(slot: u8) -> Self {
        Self::Shell(slot)
    }

    pub const fn is_agent(self) -> bool {
        matches!(self, Self::Agent)
    }

    pub const fn is_shell(self) -> bool {
        matches!(self, Self::Shell(_))
    }

    pub const fn shell_slot(self) -> Option<u8> {
        match self {
            Self::Shell(slot) => Some(slot),
            Self::Agent => None,
        }
    }
}

/// Parses a canonical wire id; non-canonical forms such as `term-02` are invalid.
fn parse_terminal_tab(id: &str) -> Option<TerminalTab> {
    match id {
        "agent" => Some(TerminalTab::Agent),
        "term" => Some(TerminalTab::shell(1)),
        _ => {
            let suffix = id.strip_prefix("term-")?;
            if suffix.is_empty() || !suffix.bytes().all(|byte| byte.is_ascii_digit()) {
                return None;
            }
            let slot = suffix.parse::<u8>().ok()?;
            if !(2..=MAX_SHELL_TABS).contains(&slot) || slot.to_string() != suffix {
                return None;
            }
            Some(TerminalTab::shell(slot))
        }
    }
}

impl Serialize for TerminalTab {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Agent => serializer.serialize_str("agent"),
            Self::Shell(1) => serializer.serialize_str("term"),
            Self::Shell(slot) => serializer.collect_str(&format_args!("term-{slot}")),
        }
    }
}

impl<'de> Deserialize<'de> for TerminalTab {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let id = String::deserialize(deserializer)?;
        parse_terminal_tab(&id).ok_or_else(|| de::Error::custom(format!("invalid terminal tab id: {id}")))
    }
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

/// App-wide notification that an Argis-managed terminal process has exited.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalLifecycleEvent {
    pub task_id: i64,
    pub tab: TerminalTab,
    pub agent_cli: Option<TerminalAgent>,
    pub session_id: u64,
    pub exit_code: u32,
    pub signal: Option<String>,
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

/// Narrow inventory entry for Argis-managed task terminals.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInventoryEntry {
    pub task_id: i64,
    pub tab: TerminalTab,
    pub state: TerminalInventoryState,
}

/// Lifecycle state for a task/tab owned by `TerminalManager`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalInventoryState {
    Running,
    Completed,
    Failed,
}

/// Session data plus the generation of its current output-channel attachment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAttachment {
    pub session: TerminalSessionInfo,
    pub attachment_id: u64,
}

#[cfg(test)]
#[path = "terminal_tests.rs"]
mod tests;
