//! Short human-readable strings for titles and `currentStep`.

use serde_json::Value;
use std::path::Path;

/// Contract limit for `currentStep`.
pub const STEP_MAX: usize = 160;
/// Soft limit for titles derived from prompts.
pub const TITLE_MAX: usize = 80;

/// Collapses whitespace and truncates to `max` chars (with `…`).
pub fn clip(text: &str, max: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= max {
        return collapsed;
    }
    let mut out: String = collapsed.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

/// `clip` to `STEP_MAX`, `None` for blank text.
pub fn step(text: &str) -> Option<String> {
    let clipped = clip(text, STEP_MAX);
    (!clipped.is_empty()).then_some(clipped)
}

/// `"Tool: hint"` for a tool call; `input` may be an object or a JSON string.
pub fn tool_step(name: &str, input: &Value) -> String {
    match tool_hint(input) {
        Some(hint) => clip(&format!("{name}: {hint}"), STEP_MAX),
        None => clip(name, STEP_MAX),
    }
}

const HINT_KEYS: &[&str] = &[
    "command",
    "cmd",
    "file_path",
    "filePath",
    "path",
    "pattern",
    "query",
    "url",
    "description",
    "prompt",
    "subject",
    "code",
];

fn tool_hint(input: &Value) -> Option<String> {
    match input {
        Value::String(s) => match serde_json::from_str::<Value>(s) {
            Ok(parsed @ Value::Object(_)) => tool_hint(&parsed),
            _ => s.lines().find(|l| !l.trim().is_empty()).map(|l| clip(l, 100)),
        },
        Value::Object(map) => HINT_KEYS.iter().find_map(|k| map.get(*k).and_then(hint_value)),
        _ => None,
    }
}

fn hint_value(value: &Value) -> Option<String> {
    match value {
        Value::String(s) if !s.trim().is_empty() => Some(clip(s, 100)),
        Value::Array(items) => {
            let parts: Vec<&str> = items.iter().filter_map(Value::as_str).collect();
            // `["/bin/zsh", "-lc", "cargo build"]` → the script is the useful bit.
            let script = match parts.as_slice() {
                [_, "-lc" | "-c", script] => script.to_string(),
                [] => return None,
                _ => parts.join(" "),
            };
            Some(clip(&script, 100))
        }
        _ => None,
    }
}

/// Last path component, for fallback titles.
pub fn dir_name(cwd: &str) -> String {
    Path::new(cwd).file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| cwd.to_string())
}

/// First non-empty of `candidates`, else the cwd's directory name.
pub fn title_or_dir<'a>(candidates: impl IntoIterator<Item = Option<&'a str>>, cwd: &str) -> String {
    candidates
        .into_iter()
        .flatten()
        .map(|t| clip(t, TITLE_MAX))
        .find(|t| !t.is_empty())
        .unwrap_or_else(|| dir_name(cwd))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn clip_collapses_and_truncates() {
        assert_eq!(clip("  a \n b  ", 10), "a b");
        let long = "x".repeat(200);
        let c = clip(&long, STEP_MAX);
        assert_eq!(c.chars().count(), STEP_MAX);
        assert!(c.ends_with('…'));
        assert_eq!(step("   "), None);
    }

    #[test]
    fn tool_step_picks_a_useful_hint() {
        assert_eq!(tool_step("Bash", &json!({"command": "cargo test", "description": "x"})), "Bash: cargo test");
        assert_eq!(tool_step("exec_command", &json!("{\"cmd\":\"ls -la\"}")), "exec_command: ls -la");
        assert_eq!(tool_step("shell", &json!({"command": ["/bin/zsh", "-lc", "pwd"]})), "shell: pwd");
        assert_eq!(tool_step("Noop", &json!({})), "Noop");
    }

    #[test]
    fn titles_fall_back_to_dir_name() {
        assert_eq!(title_or_dir([None, Some(" "), Some("Fix bug")], "/a/b"), "Fix bug");
        assert_eq!(title_or_dir([None], "/a/argis"), "argis");
    }
}
