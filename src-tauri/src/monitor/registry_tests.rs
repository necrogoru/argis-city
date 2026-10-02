use super::*;
use crate::domain::{AgentStatus, Progress, ProviderId, TokenUsage};
use crate::system::ProcessInfo;

struct FixedClock(i64);
impl Clock for FixedClock {
    fn now_ms(&self) -> i64 {
        self.0
    }
}

struct NoProcesses;
impl ProcessSource for NoProcesses {
    fn snapshot(&self) -> Vec<ProcessInfo> {
        Vec::new()
    }
}

enum Behaviour {
    Sessions(Vec<i64>),
    Fail,
    Panic,
    Unavailable,
}

struct Fake(ProviderId, Behaviour);

fn session(provider: ProviderId, started_at: i64) -> AgentSession {
    AgentSession {
        id: provider.session_id(&started_at.to_string()),
        provider,
        title: "t".into(),
        cwd: "/".into(),
        model: None,
        pid: None,
        status: AgentStatus::Idle,
        tokens: TokenUsage::default(),
        progress: Progress::none(),
        current_step: None,
        started_at,
        updated_at: started_at,
        subagents: Vec::new(),
    }
}

impl AgentProvider for Fake {
    fn id(&self) -> ProviderId {
        self.0
    }
    fn is_available(&self) -> bool {
        !matches!(self.1, Behaviour::Unavailable)
    }
    fn collect(&self, _ctx: &CollectContext) -> anyhow::Result<Vec<AgentSession>> {
        match &self.1 {
            Behaviour::Sessions(starts) => Ok(starts.iter().map(|s| session(self.0, *s)).collect()),
            Behaviour::Fail => anyhow::bail!("db locked"),
            Behaviour::Panic => panic!("boom"),
            Behaviour::Unavailable => unreachable!(),
        }
    }
}

#[test]
fn isolates_failures_and_sorts_sessions() {
    let providers: Vec<Box<dyn AgentProvider>> = vec![
        Box::new(Fake(ProviderId::Pi, Behaviour::Sessions(vec![5]))),
        Box::new(Fake(ProviderId::Codex, Behaviour::Fail)),
        Box::new(Fake(ProviderId::Claude, Behaviour::Sessions(vec![9, 3]))),
        Box::new(Fake(ProviderId::Opencode, Behaviour::Panic)),
    ];
    let registry = ProviderRegistry::new(providers, Box::new(NoProcesses), Box::new(FixedClock(42)));
    let snap = registry.collect();
    assert_eq!(snap.generated_at, 42);
    let order: Vec<_> = snap.sessions.iter().map(|s| s.id.as_str()).collect();
    assert_eq!(order, ["claude:3", "claude:9", "pi:5"]);
    let codex = snap.providers.iter().find(|p| p.provider == ProviderId::Codex).unwrap();
    assert_eq!((codex.available, codex.session_count, codex.error.as_deref()), (true, 0, Some("db locked")));
    let oc = snap.providers.iter().find(|p| p.provider == ProviderId::Opencode).unwrap();
    assert_eq!(oc.error.as_deref(), Some("provider panicked"));
    let claude = snap.providers.iter().find(|p| p.provider == ProviderId::Claude).unwrap();
    assert_eq!((claude.session_count, claude.error.as_deref()), (2, None));
}

#[test]
fn unavailable_provider_reports_no_error() {
    let providers: Vec<Box<dyn AgentProvider>> = vec![Box::new(Fake(ProviderId::Pi, Behaviour::Unavailable))];
    let snap = ProviderRegistry::new(providers, Box::new(NoProcesses), Box::new(FixedClock(1))).collect();
    let pi = &snap.providers[0];
    assert_eq!((pi.available, pi.session_count, pi.error.as_deref()), (false, 0, None));
    let json = serde_json::to_value(&snap).unwrap();
    assert_eq!(json["providers"][0]["sessionCount"], 0);
    assert_eq!(json["generatedAt"], 1);
}
