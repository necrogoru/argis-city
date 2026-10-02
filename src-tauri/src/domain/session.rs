use super::{AgentStatus, Progress, ProviderId, TokenUsage};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubAgent {
    pub id: String,
    pub title: String,
    /// e.g. "Explore", "general-purpose"; `None` when unknown.
    pub kind: Option<String>,
    pub status: AgentStatus,
    pub tokens: TokenUsage,
    pub progress: Progress,
    pub started_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    /// `"{provider}:{nativeSessionId}"`, stable across polls.
    pub id: String,
    pub provider: ProviderId,
    pub title: String,
    pub cwd: String,
    pub model: Option<String>,
    pub pid: Option<u32>,
    pub status: AgentStatus,
    pub tokens: TokenUsage,
    pub progress: Progress,
    /// Short summary of what the agent is doing now (≤ 160 chars).
    pub current_step: Option<String>,
    pub started_at: i64,
    pub updated_at: i64,
    pub subagents: Vec<SubAgent>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn sample() -> AgentSession {
        let tokens = TokenUsage::new(1, 2, 3, 4).with_context(Some(50), Some(200));
        AgentSession {
            id: "claude:abc".into(),
            provider: ProviderId::Claude,
            title: "argis".into(),
            cwd: "/tmp".into(),
            model: None,
            pid: Some(42),
            status: AgentStatus::AwaitingApproval,
            tokens,
            progress: Progress::none(),
            current_step: None,
            started_at: 1,
            updated_at: 2,
            subagents: vec![SubAgent {
                id: "a1".into(),
                title: "explore".into(),
                kind: None,
                status: AgentStatus::Done,
                tokens: TokenUsage::default(),
                progress: Progress::none(),
                started_at: 1,
                updated_at: 2,
            }],
        }
    }

    #[test]
    fn serializes_with_ui_contract_shape() {
        let v = serde_json::to_value(sample()).unwrap();
        assert_eq!(v["status"], "awaitingApproval");
        assert_eq!(v["provider"], "claude");
        assert_eq!(v["model"], Value::Null);
        assert_eq!(v["currentStep"], Value::Null);
        assert_eq!(v["startedAt"], 1);
        assert_eq!(v["tokens"]["cacheRead"], 3);
        assert_eq!(v["tokens"]["contextWindow"], 200);
        assert_eq!(v["tokens"]["contextUsed"], 50);
        assert_eq!(
            v["progress"],
            json!({"percent": null, "source": "none", "completedSteps": null, "totalSteps": null})
        );
        let sub = &v["subagents"][0];
        assert_eq!(sub["status"], "done");
        assert_eq!(sub["kind"], Value::Null);
        assert_eq!(sub["updatedAt"], 2);
    }

    #[test]
    fn never_omits_keys() {
        let v = serde_json::to_value(sample()).unwrap();
        let mut keys: Vec<_> = v.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        let expected = [
            "currentStep",
            "cwd",
            "id",
            "model",
            "pid",
            "progress",
            "provider",
            "startedAt",
            "status",
            "subagents",
            "title",
            "tokens",
            "updatedAt",
        ];
        assert_eq!(keys, expected);
        let token_keys = v["tokens"].as_object().unwrap().len();
        assert_eq!(token_keys, 7);
    }
}
