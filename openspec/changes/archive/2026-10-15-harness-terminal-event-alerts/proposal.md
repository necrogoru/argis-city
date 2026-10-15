# Proposal

## Why

Argis already shows harness and terminal state in its city and task workspace, but users can miss an approval request or a finished run while focused elsewhere. Event-based sound and desktop alerts make those moments actionable without changing how Argis observes or controls agent processes.

## What Changes

- Alert when an Argis-managed task terminal process exits, whether it is the Agent or shell tab.
- Alert when an observed harness session or subagent newly needs approval, or transitions from running to idle/done. Idle/done are treated as a completed run; errors and disappearance from snapshots do not trigger a stop alert.
- Deliver a concise macOS desktop notification and an audible cue for qualifying events, regardless of whether the dashboard or task workspace is visible.
- Detect transitions rather than repeatedly alerting on each poll, and avoid alerts for initial snapshots or terminal reattachment history.

## Capabilities

### New Capabilities
- `session-alerts`: Sound and desktop notifications for approval-needed and completed-run events from observed harness sessions and Argis-managed task terminals.

### Modified Capabilities

## Impact

- Frontend snapshot handling and terminal session lifecycle in `src/`, including the task terminal modal/rail and both live and mock `AgentSource` implementations.
- Tauri notification integration and permissions in `src-tauri/` may be needed for macOS desktop notifications; confirm before adding the plugin or capability permission.
- Add pure transition/deduplication logic and tests; document the behavior in `docs/CONTRACT.md` and the capability spec.
