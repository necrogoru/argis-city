# Proposal

## Why

Argis currently loses its in-memory mapping to a coding-agent conversation when the app exits, even when the CLI has saved that conversation natively. Reopening a task through `t` or the Dashboard terminal launcher therefore cannot reliably offer to continue the previous work.

## What Changes

- Persist resumable, provider-native agent session references against their task and worktree, separately from live PTY process state.
- When a task terminal is opened from the task board or Dashboard, offer an explicit choice to resume a saved session or start a new one.
- Resume through provider-specific CLI behavior where supported; explain when no resumable session is available and keep the new-session action usable.
- Keep Argis's current process lifecycle: quitting Argis still stops managed PTYs. Resuming after relaunch starts the CLI against its saved conversation; it does not restore the old process or terminal screen buffer.
- Keep resumable task sessions discoverable from the Dashboard after an Argis restart.

## Capabilities

### New Capabilities
- `task-terminal-resumption`: Persist and resume coding-agent CLI conversations for task worktrees, with an explicit resume-or-new choice from supported terminal entry points.

### Modified Capabilities

## Impact

- Argis-owned task persistence and Rust terminal launch/command handling.
- Frontend task-terminal navigation, resume choice, Dashboard launcher state, and Tauri/mock service contracts.
- Tests and terminal lifecycle documentation. No new dependency or change to Argis's app-exit PTY cleanup is assumed.
