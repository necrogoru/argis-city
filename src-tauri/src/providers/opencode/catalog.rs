//! Context-window sizes from OpenCode's model catalog
//! (`~/.cache/opencode/models.json`, models.dev format:
//! `{ "<provider>": { "models": { "<model>": { "limit": { "context": N } } } } }`).
//! The file is ~5 MB, so it is parsed once and re-read only when it changes.

use parking_lot::Mutex;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::SystemTime;

type Windows = HashMap<(String, String), u64>;

pub struct ModelCatalog {
    path: Option<PathBuf>,
    cache: Mutex<Option<(SystemTime, Windows)>>,
}

impl ModelCatalog {
    /// No catalog: every lookup is unknown.
    pub fn empty() -> Self {
        Self { path: None, cache: Mutex::new(None) }
    }

    pub fn from_file(path: PathBuf) -> Self {
        Self { path: Some(path), cache: Mutex::new(None) }
    }

    /// Window for `model` under `provider`; any provider's entry otherwise.
    pub fn context_window(&self, provider: Option<&str>, model: &str) -> Option<u64> {
        let mut cache = self.cache.lock();
        self.refresh(&mut cache);
        let (_, windows) = cache.as_ref()?;
        provider
            .and_then(|p| windows.get(&(p.to_owned(), model.to_owned())))
            .or_else(|| windows.iter().find(|((_, m), _)| m == model).map(|(_, w)| w))
            .copied()
    }

    fn refresh(&self, cache: &mut Option<(SystemTime, Windows)>) {
        let Some(path) = &self.path else { return };
        let Ok(modified) = std::fs::metadata(path).and_then(|m| m.modified()) else {
            *cache = None;
            return;
        };
        if cache.as_ref().is_some_and(|(at, _)| *at == modified) {
            return;
        }
        let parsed = std::fs::read(path).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok());
        *cache = parsed.map(|v| (modified, windows(&v)));
    }
}

fn windows(catalog: &Value) -> Windows {
    let mut out = Windows::new();
    for (provider, entry) in catalog.as_object().into_iter().flatten() {
        for (model, spec) in entry["models"].as_object().into_iter().flatten() {
            if let Some(context) = spec["limit"]["context"].as_u64().filter(|c| *c > 0) {
                out.insert((provider.clone(), model.clone()), context);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_by_provider_then_any_and_reloads_on_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("models.json");
        let catalog = r#"{"github-copilot":{"models":{"gpt-6-luna":{"limit":{"context":1050000}}}},
            "other":{"models":{"gpt-6-luna":{"limit":{"context":400000}},"tiny":{"limit":{}}}}}"#;
        std::fs::write(&path, catalog).unwrap();
        let models = ModelCatalog::from_file(path.clone());
        assert_eq!(models.context_window(Some("github-copilot"), "gpt-6-luna"), Some(1_050_000));
        assert_eq!(models.context_window(Some("other"), "gpt-6-luna"), Some(400_000));
        assert!(models.context_window(Some("missing"), "gpt-6-luna").is_some());
        assert_eq!(models.context_window(None, "tiny"), None);
        assert_eq!(ModelCatalog::empty().context_window(None, "gpt-6-luna"), None);
        std::fs::remove_file(&path).unwrap();
        assert_eq!(models.context_window(None, "gpt-6-luna"), None);
    }
}
