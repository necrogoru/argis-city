use std::path::{Path, PathBuf};

/// Data directories of each supported tool. Injectable so tests can point
/// providers at temp dirs.
#[derive(Debug, Clone)]
pub struct HomePaths {
    /// `~/.claude`
    pub claude: PathBuf,
    /// `~/.codex`
    pub codex: PathBuf,
    /// `~/.local/share/opencode`
    pub opencode: PathBuf,
    /// `~/.pi/agent`
    pub pi: PathBuf,
}

impl HomePaths {
    pub fn from_home(home: &Path) -> Self {
        Self {
            claude: home.join(".claude"),
            codex: home.join(".codex"),
            opencode: home.join(".local/share/opencode"),
            pi: home.join(".pi/agent"),
        }
    }

    /// Resolves the current user's home directory.
    pub fn detect() -> anyhow::Result<Self> {
        let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("cannot resolve home directory"))?;
        Ok(Self::from_home(&home))
    }
}
