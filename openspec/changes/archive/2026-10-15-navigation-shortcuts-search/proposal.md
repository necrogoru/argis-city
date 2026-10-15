# Proposal

## Why

Argis keeps Dashboard as its monitoring view, but its numeric view shortcuts are not the most useful keyboard path, and task terminals disappear from view when users return to monitoring. Removing those bindings while adding contextual Dashboard terminal access makes the existing task workflow easier to resume without interrupting monitoring. The Dashboard rail should focus on In progress tasks and support keyboard navigation so users can identify and reopen active work quickly.

## What Changes

- Remove Command+1/Command+2 and Control+1/Control+2 as app view-switch shortcuts and remove their hints. Keep Dashboard as the startup view and keep Dashboard/Tasks discoverable through the command palette.
- Preserve command-palette task search and its task-terminal action.
- Add a compact, indexed Dashboard rail showing only tasks whose workflow status is In progress, including tasks without an active terminal session. Each launcher shows a 10-character task-title preview, reveals the full title and aggregate terminal state on hover or focus, supports ArrowUp/ArrowDown or `k`/`j` focus navigation, and opens the focused task’s terminal modal on Enter with the Agent tab selected. Apply this filter only to the rail presentation so selected-house terminal matching continues to use all Argis-managed targets.
- In a selected-house summary, show a Terminal action only when the house working directory matches a task worktree with an Argis-managed terminal; open that task’s terminal modal.
- Expose Argis-owned terminal-session status to the Dashboard without changing agent snapshot polling or discovering external terminals.

## Capabilities

### New Capabilities

- `app-view-navigation`: Reach Dashboard and Tasks through palette actions without numeric view-switch shortcuts.
- `command-palette-search`: Search tasks and open their terminals from the existing command palette.
- `dashboard-terminal-navigation`: Find and reopen Argis-managed task terminals from the Dashboard rail or a matching selected house.

### Modified Capabilities

None. The project has no main OpenSpec capability specs yet; these behaviors are captured as new capabilities.

## Impact

- Frontend: app-shell terminal navigation, Dashboard right column/selected-house summary, terminal state presentation, and palette shortcut hints.
- Transport/backend: a typed inventory/status operation for Argis-managed terminal sessions, implemented in Tauri and browser mock modes; no agent snapshot changes or external process discovery.
- The rail refinement reuses task status, terminal inventory, and terminal navigation already in the change; it adds no transport contract.
- Tests and design documentation: verify keyboard shortcut removal, task-to-house matching, rail state/expansion, In progress filtering, title preview, focus navigation, and opening the correct terminal.
- No new dependency is expected.
