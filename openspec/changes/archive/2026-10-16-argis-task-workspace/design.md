# Design

## Context

See `proposal.md` for motivation and `specs/` for user-visible behavior. Argis is a Vue/TresJS frontend over a Tauri 2/Rust backend. The city is the primary view; agent providers are read-only observers polled every two seconds. The frontend uses an injected `AgentSource` with Tauri and browser-mock implementations. The project/task store, grouped task board, Git worktree actions, and app-level terminal modal are already implemented. The board has a project filter and button-driven task actions but no task search or single-key task navigation. The modal already closes on Escape and supports arrow-key tab selection; it currently focuses its close button on open and does not implement Ctrl+Tab or focus the xterm input after tab switches.

## Goals / Non-Goals

**Goals:**

- Add optional task and project management without changing the agent-session snapshot contract or writing to provider data.
- Keep the city as the default monitoring view, while providing a dedicated task workspace and modal/panel flows for editing and terminal use.
- Create task-scoped Git worktrees and embedded agent/shell sessions with explicit, safe user actions.
- Add task search and focused-task keyboard actions that reuse the current UI actions and preserve their eligibility checks.
- Make terminal close/tab controls keyboard-driven and focus the active xterm input when the modal opens or its tab changes.

**Non-Goals:**

- Cross-device synchronization, importing agent plan entries, or changing provider detection.
- Automatically initializing Git, pushing branches, or modifying tracked project files to configure worktrees.
- Task dependencies, automatic status transitions, or running task commands from task descriptions.
- Adding global single-key shortcuts, changing task status from the keyboard, or bypassing the existing branch/worktree safeguards.

## Decisions

### Local persistence and transport

- Store projects and tasks in a versioned, Argis-owned SQLite database under the application data directory. Keep it separate from all agent-tool databases and files. Use the existing bundled SQLite dependency; do not add a database dependency.
- Use a database-generated stable task identifier. Keep task rows (title, description, project reference, status, optional branch/worktree association) separate from the existing `Snapshot` wire types.
- Add typed project/task and terminal operations to the injected `AgentSource` transport and implement them for both Tauri and browser mock modes, following the repository transport convention. Keep domain logic and the Pinia task store separate from the transport facade.
- Add thin Tauri commands and document their commands/events in `docs/CONTRACT.md`. Do not change snapshot polling semantics. Run filesystem, SQLite, and Git work off the UI thread; use the existing Tauri blocking-work pattern for synchronous operations.

### Workspace navigation and UI

- Add a Tasks entry point from the city. The city remains the initial and primary monitoring view; selecting Tasks switches to a dedicated task workspace and returning to the city preserves monitoring state.
- Keep project registration and task create/edit/delete confirmation in modal or side-panel UI. The project manager lists registered projects and accepts a local path; an explicit create choice creates a missing directory.
- Show the board in three top-level groups (Pending, In progress, Other statuses), with distinct stopped/canceled/completed labels and a project filter. Task detail editing does not add a fifth task-card action.
- Open the task terminal in a large modal over the current view. Closing it returns to the previous focus target without closing its processes.

### Keyboard-first task search and actions

- Add a pure task-search helper that matches task ID, title, description, project name, and project path. Apply search together with the existing project filter, retaining the three status groups and their visible ordering.
- Keep a focused task ID in the board and derive the navigable task order from the visible groups. ArrowDown/ArrowUp from the search field moves focus to the first/last result; from a focused card it moves to the adjacent result, wrapping within the filtered set in the same way as the command palette. If filtering removes the focused task, clear that focus and let the next arrow key choose from the current results.
- Handle `c` in the active Tasks workspace to call the existing New task flow. Handle `b` and `t` only for a focused task, dispatching the same branch and terminal callbacks as the existing card buttons. Keep project availability, Git status, worktree requirements, disabled states, and explanations unchanged; keyboard actions do not create Git resources implicitly.
- Ignore single-key actions while an unrelated editable control or dialog has focus. ArrowUp/ArrowDown in the task-search field are the intentional exception; letters typed into search remain text rather than actions.

### Task-board visual refinement

- Scope visual changes to the Tasks view. Preserve the full-window workspace and Back to city action; do not add a persistent navigation rail, change the Dashboard, or alter global design tokens.
- Keep the three equal status lanes, but use lane headings, counts, gutters, and whitespace rather than enclosing each lane in a bordered panel. Keep task cards as the primary visual boundaries and remove the extra divider above each card's action row. Refine component-level spacing for a consistent rhythm without changing the shared spacing tokens.
- Keep the existing semantic status palette: Pending is neutral, In progress is teal, Stopped is amber, Canceled is red, and Completed is blue. Make these accents easier to scan in lane headings and status chips without tinting entire cards or introducing a new palette.
- Maintain at least 4.5:1 contrast for normal-size text against its rendered background. The existing `text-3` token is approximately 4.8:1 on the current task-card surface; recheck any status-chip or lane-header color/background combinations if their treatment changes.
- Use a brief, non-layout-shifting transition when a task status changes; do not add continuous status pulsing. Respect the existing `prefers-reduced-motion` behavior.
- Keep a compact keyboard-shortcut legend always visible directly below the board toolbar, using the existing keycap treatment. Show within-lane movement (`ArrowUp`/`ArrowDown`, `j`/`k`), lane movement (`ArrowLeft`/`ArrowRight`, `h`/`l`), first/last task (`gg`, `Shift+G`), and task actions (`c`, `b`, `t`). Allow the legend to wrap at narrow window widths.

### Git worktrees

- Run Git through a backend service using discrete process arguments, never by interpolating task text into a shell command. Canonicalize and validate the registered project path before Git operations.
- From an explicit task action, create branch `argis/<task-id>-<title-slug>` and worktree `<project>/.argis/worktrees/<task-id>-<title-slug>`. The task ID keeps names stable when the title changes; normalize the title only for the slug.
- Disable creation with a useful reason for a non-Git project or a branch-name collision. Never run `git init` automatically. Check branch existence before attempting creation.
- Add `.argis/worktrees/` idempotently to that clone's `.git/info/exclude`, preserving existing entries and leaving tracked ignore files unchanged. If preparation fails, report the failure rather than creating an unignored worktree.
- Stop and reap a task's terminal processes before task deletion or Git cleanup. If process cleanup fails, abort deletion and preserve the task record and worktree. After processes stop, optional Git cleanup removes the worktree without force and then deletes its branch only if worktree removal succeeds. Task-record deletion proceeds regardless of Git cleanup; if Git refuses cleanup, retain the Git resources and show their location.

### Embedded terminal process lifecycle

- Keep PTY ownership in a backend process manager keyed by task and tab. The Agent tab starts the user-selected supported CLI (Claude Code is the default); the `term` tab starts the user's interactive shell. Both use the associated worktree as their working directory.
- Use Tauri commands for start/input/resize/stop operations and a Tauri Channel for ordered terminal output. Keep a bounded 1 MiB output tail per PTY and replay it before live output on reattachment. Keep the app-level terminal modal and its xterm panes mounted independently of the conditional city/task view, preserving scrollback for quick close/reopen. Keep processes alive while users switch between task and city views; stop them before their task is deleted, and terminate/reap all remaining Argis-managed processes when the app exits.
- If starting the agent CLI fails, show the error in the Agent tab and leave the shell tab usable. Do not silently mark the task stopped or otherwise mutate task status.
- Place a stable terminal-host adapter between Rust PTY handling and the Vue terminal view.
- Render xterm with a system monospace font and zero letter spacing; keep the app's Outfit UI font for the surrounding controls.

### Terminal modal keyboard controls

- Keep Escape as a modal-level close action and do not stop the Agent or shell process when it closes. The key is consumed by the modal rather than sent to the PTY.
- Handle Ctrl+Tab only while the terminal modal is open. Prevent the host/browser tab-switch behavior, toggle between Agent and `term`, wait for the selected pane to be visible and fitted, then focus its xterm input. Opening the modal restores the Agent tab first and focuses its input after reattachment completes.
- Preserve the existing accessible tab buttons and their ArrowLeft/ArrowRight/Home/End navigation. Keyboard focus returns to the element that opened the modal after close.

### Approved terminal dependencies

- Use `portable-pty` 0.9.0 for backend PTY creation, input/output, resize, and child-process management. Keep process ownership in Argis rather than delegating it to a Tauri plugin.
- Use `@xterm/xterm` 6.0.0 for terminal rendering and `@xterm/addon-fit` 0.11.0 to fit the terminal to its visible modal container.
- Stream terminal output through Tauri Channels rather than firing frequent events; keep start/input/resize/stop as typed Tauri commands.
- The user approved these dependencies and the Channel approach before installation. Do not add a PTY plugin or new Tauri permission; pause if implementation demonstrates one is required.

### Performance and safety

- Keep agent polling independent of task operations and terminal output. Batch terminal output updates rather than routing them through scene reactivity; do not add per-frame work to the TresJS city.
- Treat typed project paths and task text as untrusted input: validate paths, pass Git/CLI arguments separately, and never execute task descriptions. Preserve the minimal Tauri capability set unless an explicitly approved terminal implementation requires a change.

## Risks / Trade-offs

- **Interactive PTY and terminal rendering add a new dependency and process boundary** → Keep them behind the approved narrow adapter; test process lifecycle and review the dependency/lockfile changes.
- **A task worktree is nested within its main checkout** → Add only a local `.git/info/exclude` rule; test in temporary repositories and never edit tracked ignore files.
- **A worktree can contain user changes when task deletion is requested** → Never force-remove it; proceed with task deletion and report any retained branch/worktree paths.
- **Agent CLI installations and PATH vary by machine** → Resolve the selected executable at launch, report failures in the Agent tab, and keep the shell tab available.
- **Terminal output can be high-volume** → Stream in bounded chunks and keep terminal buffers out of the city snapshot/render loop.
- **Single-key shortcuts can steal task/search text** → Scope them to the Tasks view, ignore editable controls and dialogs, and test the search-arrow exception explicitly.
- **Ctrl+Tab and Escape are also useful inside terminal programs** → Reserve them for the modal while it is open, as requested; keep all other terminal input flowing unchanged.

## Migration Plan

1. The task/project store, task workspace, Git operations, and approved PTY/renderer integration are already present; retain their existing local-data and process-safety boundaries.
2. Add the workspace search/focus model and keyboard handlers around the existing UI actions, then add the modal key handling and xterm focus transitions.
3. Update keyboard behavior tests and `docs/design/SPEC.md`; no database migration, new dependency, or new Tauri permission is required.
4. If rolling back the keyboard enhancement, remove its search/focus controls and key handlers while retaining task records, worktrees, terminal processes, and existing pointer actions.
