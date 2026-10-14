# Proposal

## Why

Argis makes users switch into the Tasks workspace before they can find a task or open its terminal, while dashboard navigation is mostly mouse-driven. A small set of view shortcuts and task-aware command-palette search will make common destinations reachable without interrupting monitoring.

## What Changes

- Add direct keyboard shortcuts for Dashboard and Tasks, with platform-appropriate modifier hints; keep Dashboard as the startup view.
- Add searchable Dashboard and Tasks navigation actions to the existing command palette as well as the direct shortcuts.
- Extend the existing `⌘K` / Ctrl+K command palette to search tasks and their terminal targets alongside agents and actions.
- Let a task search result open its terminal over the current view, reattaching to running sessions or showing the existing start controls when none are running.
- Keep tasks without worktrees searchable, explain why their terminal cannot open, and offer an explicit action to go to Tasks to create a worktree.
- Do not add a separate terminal shortcut or create Git worktrees as a side effect of search.

## Capabilities

### New Capabilities

- `app-view-navigation`: Navigate directly between Dashboard and Tasks with keyboard shortcuts while preserving the default Dashboard view.
- `command-palette-search`: Search tasks and terminal targets from the command palette and open a task terminal without navigating to the Tasks workspace.

### Modified Capabilities

None. The project has no main OpenSpec capability specs yet; these behaviors are captured as new capabilities.

## Impact

- Frontend: app-level shortcut handling, command-palette search/result actions, task data availability from the dashboard, and an app-level terminal-modal host.
- Existing task and terminal services are reused; this change does not require a new backend API or dependency unless implementation reveals a gap.
- No changes to agent snapshot polling, provider observers, or the Dashboard startup behavior.
