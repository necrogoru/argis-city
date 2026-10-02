//! Runs every provider; one failing provider never breaks the others.

use crate::domain::{AgentSession, ProviderSummary, Snapshot};
use crate::providers::{AgentProvider, CollectContext};
use crate::system::{Clock, ProcessSource};
use std::panic::{catch_unwind, AssertUnwindSafe};

pub struct ProviderRegistry {
    providers: Vec<Box<dyn AgentProvider>>,
    processes: Box<dyn ProcessSource>,
    clock: Box<dyn Clock>,
}

impl ProviderRegistry {
    pub fn new(
        providers: Vec<Box<dyn AgentProvider>>,
        processes: Box<dyn ProcessSource>,
        clock: Box<dyn Clock>,
    ) -> Self {
        Self { providers, processes, clock }
    }

    /// One snapshot: sessions sorted by provider then `startedAt`.
    pub fn collect(&self) -> Snapshot {
        let ctx = CollectContext { processes: self.processes.snapshot(), now_ms: self.clock.now_ms() };
        let mut sessions = Vec::new();
        let mut providers = Vec::with_capacity(self.providers.len());
        for provider in &self.providers {
            let (found, summary) = run(provider.as_ref(), &ctx);
            sessions.extend(found);
            providers.push(summary);
        }
        sessions.sort_by(|a, b| (a.provider, a.started_at, &a.id).cmp(&(b.provider, b.started_at, &b.id)));
        for session in &mut sessions {
            session.subagents.sort_by_key(|s| s.started_at);
        }
        Snapshot { generated_at: ctx.now_ms, sessions, providers }
    }
}

fn run(provider: &dyn AgentProvider, ctx: &CollectContext) -> (Vec<AgentSession>, ProviderSummary) {
    let summary =
        |available, count, error| ProviderSummary { provider: provider.id(), available, session_count: count, error };
    if !provider.is_available() {
        return (Vec::new(), summary(false, 0, None));
    }
    match catch_unwind(AssertUnwindSafe(|| provider.collect(ctx))) {
        Ok(Ok(found)) => {
            let count = found.len();
            (found, summary(true, count, None))
        }
        Ok(Err(err)) => (Vec::new(), summary(true, 0, Some(format!("{err:#}")))),
        Err(_) => (Vec::new(), summary(true, 0, Some("provider panicked".into()))),
    }
}

#[cfg(test)]
#[path = "registry_tests.rs"]
mod tests;
