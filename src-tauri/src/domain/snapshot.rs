use super::{AgentSession, ProviderId};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    pub provider: ProviderId,
    /// The tool's data directory exists on this machine.
    pub available: bool,
    pub session_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub generated_at: i64,
    pub sessions: Vec<AgentSession>,
    pub providers: Vec<ProviderSummary>,
}
