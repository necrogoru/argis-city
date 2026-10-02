use std::path::{Path, PathBuf};

/// A running OS process, reduced to what providers need.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub cmd: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub started_at_ms: i64,
}

/// Lists live processes. Implemented over `sysinfo`; faked in tests.
pub trait ProcessSource: Send + Sync {
    fn snapshot(&self) -> Vec<ProcessInfo>;
}

/// Script runtimes a CLI may run under (`node …/codex.js`).
const RUNTIMES: &[&str] = &["node", "bun", "deno", "tsx", "npx", "bunx"];

impl ProcessInfo {
    /// True when this process is `tool`: its name, its executable, or (when the
    /// executable is a JS runtime) one of its script arguments is named `tool`.
    pub fn is_tool(&self, tool: &str) -> bool {
        if self.name == tool {
            return true;
        }
        let Some(exe) = self.cmd.first() else { return false };
        let exe = stem(exe);
        if exe == tool {
            return true;
        }
        RUNTIMES.contains(&exe.as_str())
            && self.cmd.iter().skip(1).filter(|a| !a.starts_with('-')).any(|a| stem(a) == tool)
    }
}

/// File name without directory and without a `.js`/`.mjs`/`.cjs`/`.ts` suffix.
fn stem(arg: &str) -> String {
    let base = Path::new(arg).file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    for ext in [".js", ".mjs", ".cjs", ".ts"] {
        if let Some(stripped) = base.strip_suffix(ext) {
            return stripped.to_string();
        }
    }
    base
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(name: &str, cmd: &[&str]) -> ProcessInfo {
        ProcessInfo {
            pid: 1,
            parent_pid: None,
            name: name.into(),
            cmd: cmd.iter().map(|s| s.to_string()).collect(),
            cwd: None,
            started_at_ms: 0,
        }
    }

    #[test]
    fn matches_by_name_exe_or_runtime_script() {
        assert!(proc("codex", &[]).is_tool("codex"));
        assert!(proc("x", &["/opt/bin/opencode", "run"]).is_tool("opencode"));
        assert!(proc("node", &["node", "/usr/lib/@openai/codex/bin/codex.js"]).is_tool("codex"));
        assert!(proc("bun", &["bun", "--smol", "/x/pi"]).is_tool("pi"));
    }

    #[test]
    fn ignores_unrelated_processes() {
        assert!(!proc("vim", &["vim", "pi"]).is_tool("pi"));
        assert!(!proc("node", &["node", "server.js"]).is_tool("codex"));
        assert!(!proc("pip", &["pip"]).is_tool("pi"));
    }
}
