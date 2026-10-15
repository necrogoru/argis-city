# Design

## Context

See `proposal.md` and `specs/session-alerts/spec.md` for motivation and observable behavior. Agent snapshots are replaced every two seconds and already carry stable session IDs, provider errors, session statuses, and subagents. Managed PTYs publish output and exit events through a Tauri Channel attached by the terminal UI; a reattached completed PTY replays its exit event. The current notification stack has no OS notification plugin, and the default Tauri capability is intentionally minimal.

## Goals / Non-Goals

**Goals:**
- Detect approval and completion transitions once, while keeping the transition logic deterministic and unit-testable.
- Receive managed terminal exits independently of a mounted terminal pane, then route all alert sources through one app-lifetime coordinator.
- Keep native notification and sound delivery isolated from UI components and preserve graceful behavior when macOS notification permission is unavailable.

**Non-Goals:**
- Change provider detection, status meanings, PTY lifecycle, or agent process control.
- Alert on errors, sessions disappearing from snapshots, historical approvals present at startup, or task-status changes.
- Add per-event settings, an alert history, or controls that approve/deny agent requests.

## Decisions

1. **Use a pure snapshot transition tracker and establish a startup baseline.** Compare stable session and subagent IDs across accepted snapshots. The first snapshot seeds state without alerts; later arrivals already awaiting approval and transitions into approval can alert, while completion alerts require a previously observed `running` state followed by `idle` or `done`. Do not synthesize completion from a missing session. If a provider reports a collection error, hold that provider's last known states rather than interpreting the error snapshot as a transition. This is preferable to putting status-edge logic in Vue components, where remounting or polling cadence could replay alerts.

2. **Broadcast managed PTY exits separately from output Channels.** Emit a small app-wide terminal lifecycle event from the manager's actual process-exit path, containing task ID, tab, selected agent CLI (nullable for the shell tab), terminal session ID, exit code, and signal. The CLI identity lets the coordinator correlate only the matching observed provider. Subscribe through `AgentSource` for the app lifetime and resolve the task title from the task store. Keep the existing Channel for xterm output and reattachment; do not infer exits by polling inventory, which can miss short-lived processes, or rely on a pane-local listener, which is detached when the pane is unmounted.

3. **Route both sources through one app-lifetime alert coordinator.** The coordinator consumes snapshot transitions and terminal lifecycle events, creates concise alert content, and calls an isolated delivery service. It must remain mounted across Dashboard/Tasks view changes. The service owns OS notification delivery and the audible cue; UI components do not call Tauri APIs directly. Keep the mock `AgentSource` contract aligned so transition behavior can be tested without launching PTYs or requiring macOS.

4. **Deduplicate on stable event identity and correlate managed Agent completion.** Key observed transitions by session/subagent ID and transition type, and terminal exits by terminal session ID. When a managed Agent terminal and an observed harness session refer to the same provider (using the terminal event's `agentCli`) and normalized task worktree, treat their near-concurrent completion signals as one logical completion; approval alerts remain sourced from provider status. This avoids duplicate noise without conflating shell exits or unrelated sessions.

5. **Use native macOS notifications, with a permission-safe sound fallback.** The repository has no notification plugin or permission today. Implement desktop delivery behind the existing service boundary; before adding a Tauri notification dependency/plugin or capability permission, obtain the user's explicit approval as required by the project rules. Request notification authorization only when needed and do not repeat prompts after denial. Keep app sound delivery independent of OS notification permission, and verify it works while the app is backgrounded and when notifications are denied. Do not add a general-purpose dependency for sound without separate approval.

## Risks / Trade-offs

- [Provider snapshots can temporarily fail or arrive late] → Preserve prior state for providers reporting errors and deduplicate by stable IDs; never infer a completion from absence.
- [Managed Agent and provider observations may not map cleanly to the same run] → Correlate only when provider identity and normalized task worktree match; otherwise deliver independent events rather than suppressing a potentially distinct alert.
- [macOS notification authorization or audio playback may be unavailable] → Keep notification and sound failure-isolated, preserve the permitted channel, and test denied-permission/background cases on macOS.
- [A new global lifecycle event expands the Rust/UI contract] → Add the typed event in Rust and TypeScript, keep the existing terminal output Channel unchanged, and document the event in `docs/CONTRACT.md`.

## Migration Plan

No persisted data or schema migration is required. Register the notification plugin/permission only after explicit approval; if approval is declined, pause native-notification implementation and return for a scope decision rather than silently replacing the requested desktop notification with an in-app-only message.
