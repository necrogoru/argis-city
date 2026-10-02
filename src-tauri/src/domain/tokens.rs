use serde::Serialize;

/// Token accounting for one session or subagent.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    /// `input + output + cache_read + cache_write`, accumulated.
    pub total: u64,
    /// Tokens occupying the context window on the latest turn.
    pub context_used: Option<u64>,
    pub context_window: Option<u64>,
}

impl TokenUsage {
    pub fn new(input: u64, output: u64, cache_read: u64, cache_write: u64) -> Self {
        Self {
            input,
            output,
            cache_read,
            cache_write,
            total: input + output + cache_read + cache_write,
            context_used: None,
            context_window: None,
        }
    }

    pub fn with_context(mut self, used: Option<u64>, window: Option<u64>) -> Self {
        self.context_used = used;
        self.context_window = window.filter(|w| *w > 0);
        self
    }

    /// `context_used / context_window` as 0–100, when both are known.
    pub fn context_percent(&self) -> Option<f64> {
        let used = self.context_used?;
        let window = self.context_window.filter(|w| *w > 0)?;
        Some((used as f64 / window as f64 * 100.0).clamp(0.0, 100.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn total_is_sum_of_parts() {
        assert_eq!(TokenUsage::new(1, 2, 3, 4).total, 10);
    }

    #[test]
    fn context_percent_needs_both_values() {
        let t = TokenUsage::new(0, 0, 0, 0);
        assert_eq!(t.context_percent(), None);
        assert_eq!(t.with_context(Some(50), None).context_percent(), None);
        assert_eq!(t.with_context(Some(50), Some(0)).context_percent(), None);
        let p = t.with_context(Some(50_000), Some(200_000)).context_percent();
        assert_eq!(p, Some(25.0));
        let over = t.with_context(Some(300), Some(200)).context_percent();
        assert_eq!(over, Some(100.0));
    }
}
