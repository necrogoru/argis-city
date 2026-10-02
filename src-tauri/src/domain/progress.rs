use super::{AgentStatus, TokenUsage};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProgressSource {
    Plan,
    Context,
    Status,
    None,
}

/// Completed vs. total steps of the latest todo/plan list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PlanCounts {
    pub completed: u32,
    pub total: u32,
}

impl PlanCounts {
    /// Counts statuses, treating `completed`/`done` as finished and ignoring
    /// `cancelled`/`deleted` items entirely.
    pub fn from_statuses<'a>(statuses: impl IntoIterator<Item = &'a str>) -> Self {
        let mut counts = Self::default();
        for status in statuses {
            match status {
                "cancelled" | "canceled" | "deleted" => {}
                "completed" | "done" => {
                    counts.completed += 1;
                    counts.total += 1;
                }
                _ => counts.total += 1,
            }
        }
        counts
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// 0–100, or `None` when it cannot be estimated.
    pub percent: Option<f64>,
    pub source: ProgressSource,
    pub completed_steps: Option<u32>,
    pub total_steps: Option<u32>,
}

impl Progress {
    pub fn none() -> Self {
        Self { percent: None, source: ProgressSource::None, completed_steps: None, total_steps: None }
    }

    /// `None` for an empty plan, so callers can fall through the precedence.
    pub fn from_plan(completed: u32, total: u32) -> Option<Self> {
        if total == 0 {
            return None;
        }
        let completed = completed.min(total);
        Some(Self {
            percent: Some(round1(completed as f64 / total as f64 * 100.0)),
            source: ProgressSource::Plan,
            completed_steps: Some(completed),
            total_steps: Some(total),
        })
    }

    pub fn from_context(tokens: &TokenUsage) -> Option<Self> {
        let percent = tokens.context_percent()?;
        Some(Self { percent: Some(round1(percent)), source: ProgressSource::Context, ..Self::none() })
    }

    fn done() -> Self {
        Self { percent: Some(100.0), source: ProgressSource::Status, ..Self::none() }
    }

    /// Contract precedence: plan → status(done) → context → none.
    pub fn resolve(plan: Option<PlanCounts>, status: AgentStatus, tokens: &TokenUsage) -> Self {
        plan.and_then(|p| Self::from_plan(p.completed, p.total))
            .or_else(|| (status == AgentStatus::Done).then(Self::done))
            .or_else(|| Self::from_context(tokens))
            .unwrap_or_else(Self::none)
    }
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(used: u64, window: u64) -> TokenUsage {
        TokenUsage::default().with_context(Some(used), Some(window))
    }

    #[test]
    fn plan_wins_over_everything() {
        let plan = Some(PlanCounts { completed: 1, total: 4 });
        let p = Progress::resolve(plan, AgentStatus::Done, &ctx(10, 100));
        assert_eq!(p.source, ProgressSource::Plan);
        assert_eq!(p.percent, Some(25.0));
        assert_eq!((p.completed_steps, p.total_steps), (Some(1), Some(4)));
    }

    #[test]
    fn empty_plan_falls_through_to_status_then_context() {
        let empty = Some(PlanCounts::default());
        let done = Progress::resolve(empty, AgentStatus::Done, &ctx(10, 100));
        assert_eq!((done.source, done.percent), (ProgressSource::Status, Some(100.0)));
        let running = Progress::resolve(empty, AgentStatus::Running, &ctx(10, 100));
        assert_eq!((running.source, running.percent), (ProgressSource::Context, Some(10.0)));
    }

    #[test]
    fn nothing_known_is_none() {
        let p = Progress::resolve(None, AgentStatus::Idle, &TokenUsage::default());
        assert_eq!(p, Progress::none());
    }

    #[test]
    fn plan_counts_ignore_cancelled() {
        let c = PlanCounts::from_statuses(["completed", "in_progress", "pending", "cancelled"]);
        assert_eq!(c, PlanCounts { completed: 1, total: 3 });
    }
}
