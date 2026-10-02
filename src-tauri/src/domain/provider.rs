use serde::Serialize;
use std::fmt;

/// Coding-agent tool. Declaration order is the UI sort order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Claude,
    Codex,
    Opencode,
    Pi,
}

impl ProviderId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Opencode => "opencode",
            Self::Pi => "pi",
        }
    }

    /// Stable session id: `"{provider}:{nativeId}"`.
    pub fn session_id(self, native: &str) -> String {
        format!("{}:{native}", self.as_str())
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
