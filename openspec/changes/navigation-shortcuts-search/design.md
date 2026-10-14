# Design

## Context

See `proposal.md` for motivation and the capability specs for user-visible behavior. `App.vue` currently switches between the city Dashboard and `TaskWorkspace`; switching views unmounts the workspace. The Dashboard's `TopBar` owns the `⌘K` palette, whose results currently cover agent sessions and actions. `TaskWorkspace` loads the task store, and its load path also refreshes Git status for every task. `TerminalModal` is mounted under `TaskBoard`; it can reattach both terminal tabs for a known task, but there is no terminal-session enumeration operation.

The existing Tauri/mock `AgentSource` already lists tasks and reattaches a terminal by task ID and tab. Task and terminal data remain separate from the agent snapshot and its polling loop.

## Goals / Non-Goals

**Goals:**

- Route view shortcuts and palette search through shared app-level state so they work consistently across the primary views.
- Reuse the current task and terminal services and preserve current view, terminal process, and monitoring state when opening a result.
- Avoid doing Git status checks or creating Git resources just to search.

**Non-Goals:**

- Add a standalone terminal browser, a direct terminal hotkey, or backend terminal enumeration.
- Change task lifecycle, terminal startup commands, Git worktree behavior, provider polling, or the Dashboard startup view.

## Decisions

### Handle primary-view shortcuts at the app shell

Register Command+1 / Command+2 on macOS and Control+1 / Control+2 elsewhere at the app shell, mapping to Dashboard and Tasks. Reuse the platform detection and shortcut-label conventions in `useModKey`, while adding a guard for editable controls and xterm's input surface. Keep the existing default `city` state unchanged. Show platform-appropriate shortcut hints wherever the destinations are presented, and expose the bindings accessibly.

This keeps shortcuts available after either view has mounted and avoids duplicating key handlers in view components. Keeping handlers inside `TopBar` or `TaskWorkspace` was rejected because one of those components is unmounted at a time.

### Make the palette and terminal host app-level

Move ownership of palette-open state and the `CommandPalette` instance to the app shell. Keep the Dashboard search trigger as a control for that shared palette, and make the existing `⌘K` / Ctrl+K binding open it from either primary view. The palette remains an overlay and does not change `activeView` when opened or closed.

Add searchable `Show Dashboard` and `Open Tasks` actions to the existing Actions section. Bind them to the same `appView` store methods as the direct shortcuts, include platform-appropriate shortcut hints, and keep them available alongside task results. This makes the direct shortcuts discoverable without making them the only navigation path.

Move terminal target/open state to a shared app-level navigation store (or equivalent app-shell state) and render one `TerminalModal` host outside the conditional Dashboard/Tasks view tree. Both a palette result and the task-board action dispatch the same open-terminal request. Closing the modal leaves the current primary view unchanged; keeping the host mounted allows xterm buffers and backend-owned sessions to survive view switches. Replacing one target with another detaches the old UI attachment through the existing terminal-session lifecycle before attaching the new target.

Keeping the modal under `TaskBoard` was rejected because opening a terminal from Dashboard would otherwise require entering Tasks, and switching views would unmount its terminal panes.

### Reuse task data without running Git checks during search

Extend the task store with cached task/project availability suitable for palette search. Search loading uses `listTasks` and `listProjects` only; it must not call `getTaskGitStatus` for every task. Invalidate or refresh the search cache after task/project mutations and refresh it when the palette opens if it has not been loaded yet. Reuse the existing task search ranking/highlight conventions where practical, matching task ID, title, description, and project path.

Calling the current full `load()` path from the palette was rejected because that path checks Git status for each task and is unnecessary for matching or opening a terminal.

### Treat each task as the terminal search target

Search results represent tasks, with project/status context and a direct terminal action. Terminal access uses the existing `reattachTerminalSession(taskId, tab, ...)` operation for the Agent and shell tabs when the modal opens; no separate list-running-sessions API is needed. If no process is attached, the current modal already exposes the controls to start the Agent or shell.

Adding a separate terminal-session chooser or enumerating all PTYs was rejected: the user chose command-palette task/terminal search instead of a dedicated terminal shortcut, and the existing task-keyed reattach operation can restore the relevant sessions after selection.

For a task without a worktree, keep the task searchable, mark terminal access unavailable, and provide a separate explicit action to switch to Tasks. Search itself never invokes branch/worktree creation.

## Risks / Trade-offs

- **Palette task data can become stale after edits made elsewhere** → Share the task store, invalidate it on every task/project mutation, and refresh on palette open when needed.
- **Opening a terminal from Dashboard introduces cross-view UI state** → Keep one terminal target and modal host at the app shell; use the same open action from TaskBoard and palette results.
- **Global shortcuts can steal input from forms or xterm** → Ignore view-switch shortcuts while focus is in editable elements or terminal input; test these paths on macOS and non-macOS modifier behavior.
- **Search may return a task whose worktree was removed outside Argis** → Treat terminal reattach/start failures as pane-level errors and keep the user in the current view; do not silently create or repair Git resources.

## Migration Plan

No data migration is required. Ship the shortcuts and palette additions as a normal app update. If rolling back, remove the palette result actions and app-level navigation bindings/host; task records, worktrees, terminal-manager ownership, and existing Dashboard behavior remain unchanged.
