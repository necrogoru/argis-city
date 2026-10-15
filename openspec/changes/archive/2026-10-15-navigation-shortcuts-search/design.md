# Design

## Context

`App.vue` already hosts the command palette and one app-level task terminal modal. `RightColumn` switches between the agent list and selected-house panel. Task data can be loaded through the task store without running Git checks. `TerminalManager` owns PTYs keyed by task and tab, but currently exposes no inventory operation; the app-level terminal navigation store tracks only the currently open task.

## Goals / Non-Goals

**Goals:**

- Keep Dashboard as the startup view and retain palette-based navigation/search while removing numeric view bindings and hints.
- Provide a Dashboard view of Argis-managed task terminals, and a house-summary action that opens only a matching task terminal.
- Keep terminal inventory separate from the agent snapshot and keep external terminals undiscovered.

**Non-Goals:**

- Change task lifecycle, worktree creation, terminal process ownership, or agent-provider detection.
- Add a dedicated terminal browser or a shortcut that bypasses task/worktree safeguards.
- Change the Dashboard startup view or agent snapshot polling.

## Decisions

### Keep primary-view navigation in the palette

Remove the app-shell Command+1/Command+2 and Control+1/Control+2 bindings, their accessible shortcut declarations, and their hints. Keep the Dashboard startup state and the existing searchable Dashboard/Tasks palette actions, but show no numeric shortcut hints for those actions.

### Expose a narrow inventory of Argis-managed terminals

Add a typed Tauri/mock operation that reports the task/tab and lifecycle state of sessions owned by `TerminalManager`. The Dashboard rail uses this inventory plus app-session terminal targets already opened in Argis; it never scans processes or treats provider-observed terminals as Argis-owned. Refresh the inventory on app start and after terminal changes, and refresh it while the Dashboard is visible so exits that occur while a modal is closed update the rail. Keep the payload outside `Snapshot` and do not change the provider poller.

Aggregate a task’s two tabs for the rail: running if either tab is running; pending if a tab is starting and none is running; unavailable if startup failed and no tab is active; completed if a started session has exited and neither tab is active; otherwise idle. Use the existing house-status visual treatment for these labels.

### Place the launcher rail alongside the Dashboard right column

Keep the existing agent list/selected-house panel behavior. Add a compact vertical indexed rail alongside that content so it remains available in either right-column state. Hover expands a launcher to its full task title; focus and accessible labels expose the same title and state without requiring hover. Activating a launcher opens the app-level modal for that task with the Agent tab selected.

### Filter and keyboard-focus Dashboard tasks

Filter the rail’s rendered entries to tasks whose workflow status is `inProgress`, regardless of whether either terminal tab is running. Apply the filter in the rail presentation rather than to the shared `TerminalRailStore.entries`; selected-house matching must continue to find Argis-managed terminal targets for tasks omitted from the visible rail. An In progress task with no running session remains available through the rail and uses the existing modal, start controls, and terminal-availability behavior; opening it must not start a process or create Git resources automatically.

Show the first 10 characters of the title in the compact launcher, while hover/focus exposes the full title and aggregate terminal state and the accessible name retains the full title and state. When a launcher button has focus, ArrowDown/`j` and ArrowUp/`k` move focus through visible entries in display order and wrap at the ends. Enter uses the existing activation path, opens the Agent tab, and leaves Dashboard active. Do not install a global shortcut: keys outside the focused rail, including editable fields and terminal input, retain their existing behavior. Ignore modified, repeated, or composing `j`/`k` key events.

### Match a selected house to its task worktree

Load cached task/project data through the existing no-Git-check search path when the Dashboard needs it. Compare the selected house’s normalized `cwd` with each task’s normalized `worktreePath`; show Terminal only for a match that has an Argis-managed terminal target/session. Opening the action uses the shared terminal-navigation state and leaves the Dashboard view unchanged. A missing or stale task match hides the action rather than creating or repairing Git resources.

## Risks / Trade-offs

- **Inventory can become stale while a terminal modal is closed** → Refresh the small Argis-owned session list independently of agent snapshots while Dashboard is visible.
- **House and worktree paths can differ in representation** → Normalize path separators and absolute-path syntax before matching; do not infer a match from title or process name.
- **Rail consumes right-column space** → Keep it compact by default and expand only the hovered/focused entry.
- **A 10-character preview can be ambiguous** → Keep the full title and terminal state available on hover/focus and in the accessible name.
- **The running-only rail hides other task statuses** → Keep the Tasks workspace and selected-house Terminal action available; the rail filter must not prune shared terminal inventory.
- **Task search cache may be cold on Dashboard launch** → Load projects/tasks through the cached list path only; do not invoke per-task Git status checks.

## Migration Plan

No data migration is required. Add the terminal inventory to both AgentSource implementations and the app-shell UI, remove obsolete shortcut handling/hints, and preserve the existing terminal manager lifecycle. Rollback removes the rail/action and inventory transport while leaving task records and terminal process behavior unchanged.
