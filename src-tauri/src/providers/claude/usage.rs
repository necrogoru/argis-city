//! Token accounting for Claude transcripts: dedupe by `message.id` and the
//! context-window rule.

use crate::domain::TokenUsage;
use serde_json::Value;
use std::collections::HashMap;

const WINDOW_DEFAULT: u64 = 200_000;
const WINDOW_1M: u64 = 1_000_000;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Usage {
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_write: u64,
}

impl Usage {
    /// Parses an Anthropic `message.usage` object.
    pub fn parse(v: &Value) -> Option<Self> {
        let n = |k: &str| v.get(k).and_then(Value::as_u64).unwrap_or(0);
        v.is_object().then(|| Self {
            input: n("input_tokens"),
            output: n("output_tokens"),
            cache_read: n("cache_read_input_tokens"),
            cache_write: n("cache_creation_input_tokens"),
        })
    }

    fn context(self) -> u64 {
        self.input + self.cache_read + self.cache_write
    }

    fn add(&mut self, o: Self) {
        self.input += o.input;
        self.output += o.output;
        self.cache_read += o.cache_read;
        self.cache_write += o.cache_write;
    }

    fn sub(&mut self, o: Self) {
        self.input = self.input.saturating_sub(o.input);
        self.output = self.output.saturating_sub(o.output);
        self.cache_read = self.cache_read.saturating_sub(o.cache_read);
        self.cache_write = self.cache_write.saturating_sub(o.cache_write);
    }
}

/// Running totals where repeated lines of one API message count once.
#[derive(Debug, Default)]
pub struct UsageLedger {
    by_message: HashMap<String, Usage>,
    totals: Usage,
    last: Option<Usage>,
}

impl UsageLedger {
    /// Records `usage`; a repeated `id` replaces its previous value.
    pub fn record(&mut self, id: Option<&str>, usage: Usage) {
        if let Some(previous) = id.and_then(|id| self.by_message.insert(id.to_owned(), usage)) {
            self.totals.sub(previous);
        }
        self.totals.add(usage);
        self.last = Some(usage);
    }

    /// Totals plus context: used = last turn's input + cache read/write;
    /// window = 1M for `[1m]` models or when usage exceeds 200k, else 200k.
    pub fn tokens(&self, model_known: bool, one_m: bool) -> TokenUsage {
        let t = self.totals;
        let used = self.last.map(Usage::context);
        let window = if one_m || used.is_some_and(|u| u > WINDOW_DEFAULT) {
            Some(WINDOW_1M)
        } else {
            (used.is_some() || model_known).then_some(WINDOW_DEFAULT)
        };
        TokenUsage::new(t.input, t.output, t.cache_read, t.cache_write).with_context(used, window)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(input: u64, output: u64, cr: u64, cw: u64) -> Usage {
        Usage { input, output, cache_read: cr, cache_write: cw }
    }

    #[test]
    fn dedupes_by_message_id_keeping_latest() {
        let mut l = UsageLedger::default();
        l.record(Some("m1"), u(10, 1, 100, 5));
        l.record(Some("m1"), u(10, 7, 100, 5));
        l.record(Some("m2"), u(2, 3, 200, 0));
        l.record(None, u(1, 1, 0, 0));
        let t = l.tokens(true, false);
        assert_eq!((t.input, t.output, t.cache_read, t.cache_write), (13, 11, 300, 5));
        assert_eq!(t.total, 329);
        assert_eq!(t.context_used, Some(1));
        assert_eq!(t.context_window, Some(200_000));
    }

    #[test]
    fn window_rule() {
        let mut l = UsageLedger::default();
        assert_eq!(l.tokens(false, false).context_window, None);
        assert_eq!(l.tokens(true, true).context_window, Some(1_000_000));
        l.record(Some("a"), u(1, 0, 250_000, 0));
        assert_eq!(l.tokens(true, false).context_window, Some(1_000_000));
    }
}
