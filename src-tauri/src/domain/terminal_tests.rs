use super::{TerminalTab, MAX_SHELL_TABS};
use serde_json::json;

fn round_trip(tab: TerminalTab, id: &str) {
    let serialized = serde_json::to_value(tab).unwrap();
    assert_eq!(serialized, json!(id));
    let deserialized: TerminalTab = serde_json::from_value(serialized).unwrap();
    assert_eq!(deserialized, tab);
}

#[test]
fn serializes_agent_and_shell_slots_with_canonical_ids() {
    round_trip(TerminalTab::Agent, "agent");
    round_trip(TerminalTab::shell(1), "term");
    round_trip(TerminalTab::shell(2), "term-2");
    round_trip(TerminalTab::shell(MAX_SHELL_TABS), "term-6");
}

#[test]
fn rejects_unknown_and_non_canonical_shell_ids() {
    for id in ["", "shell", "term-", "term-0", "term-1", "term-7", "term-02", "term-+2", "term-2 ", "term-99"] {
        assert!(serde_json::from_value::<TerminalTab>(json!(id)).is_err(), "{id} should be rejected");
    }
}

#[test]
fn classifies_agent_and_shell_tabs() {
    assert!(TerminalTab::Agent.is_agent());
    assert!(!TerminalTab::shell(1).is_agent());
    assert!(TerminalTab::shell(1).is_shell());
    assert!(!TerminalTab::Agent.is_shell());
    assert_eq!(TerminalTab::Agent.shell_slot(), None);
    assert_eq!(TerminalTab::shell(1).shell_slot(), Some(1));
    assert_eq!(TerminalTab::shell(4).shell_slot(), Some(4));
}
