# Design

## Context

See `proposal.md` for motivation and `specs/` for user-visible behavior. Argis is a Vue/TresJS frontend over a Tauri 2/Rust backend. The city is the primary view; agent providers are read-only observers polled every two seconds. The frontend uses an injected `AgentSource` with Tauri and browser-mock implementations. Argis currently has no app-owned project/task store or interactive terminal support; bundled `rusqlite` is already available.

## Goals / Non-Goals

**Goals:**

- Add optional task and project management without changing the agent-session snapshot contract or writing to provider data.
- Keep the city as the default monitoring view, while providing a dedicated task workspace and modal/panel flows for editing and terminal use.
- Create task-scoped Git worktrees and embedded agent/shell sessions with explicit, safe user actions.

**Non-Goals:**

- Cross-device synchronization, importing agent plan entries, or changing provider detection.
- Automatically initializing Git, pushing branches, or modifying tracked project files to configure worktrees.
- Task dependencies, automatic status transitions, or running task commands from task descriptions.

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
- Open the task terminal in a large modal over the task workspace. Closing it returns to the board without closing its processes.

### Git worktrees

- Run Git through a backend service using discrete process arguments, never by interpolating task text into a shell command. Canonicalize and validate the registered project path before Git operations.
- From an explicit task action, create branch `argis/<task-id>-<title-slug>` and worktree `<project>/.argis/worktrees/<task-id>-<title-slug>`. The task ID keeps names stable when the title changes; normalize the title only for the slug.
- Disable creation with a useful reason for a non-Git project or a branch-name collision. Never run `git init` automatically. Check branch existence before attempting creation.
- Add `.argis/worktrees/` idempotently to that clone's `.git/info/exclude`, preserving existing entries and leaving tracked ignore files unchanged. If preparation fails, report the failure rather than creating an unignored worktree.
- Stop and reap a task's terminal processes before task deletion or Git cleanup. If process cleanup fails, abort deletion and preserve the task record and worktree. After processes stop, optional Git cleanup removes the worktree without force and then deletes its branch only if worktree removal succeeds. Task-record deletion proceeds regardless of Git cleanup; if Git refuses cleanup, retain the Git resources and show their location.

### Embedded terminal process lifecycle

- Keep PTY ownership in a backend process manager keyed by task and tab. The Agent tab starts the user-selected supported CLI (Claude Code is the default); the `term` tab starts the user's interactive shell. Both use the associated worktree as their working directory.
- Use Tauri commands for start/input/resize/stop operations and a Tauri Channel for ordered terminal output. Keep a bounded 1 MiB output tail per PTY and replay it before live output on reattachment. Keep xterm instances mounted while the task board remains mounted and the modal is closed, preserving their full xterm scrollback for a quick close/reopen. Keep processes alive while users switch between task and city views; stop them before their task is deleted, and terminate/reap all remaining Argis-managed processes when the app exits.
- If starting the agent CLI fails, show the error in the Agent tab and leave the shell tab usable. Do not silently mark the task stopped or otherwise mutate task status.
- Place a stable terminal-host adapter between Rust PTY handling and the Vue terminal view.
- Render xterm with a system monospace font and zero letter spacing; keep the app's Outfit UI font for the surrounding controls.

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

## Migration Plan

1. Add the app-owned SQLite schema and task/project services without changing or migrating agent-tool data.
2. Add the task workspace and Git operations behind the optional Tasks entry point; retain the city as the startup view.
3. Add the approved PTY/renderer integration and process cleanup lifecycle.
4. If rolling back the feature, disable its entry point and retain the app-owned task database and user-created worktrees. Do not automatically remove project data, Git branches, or local exclude entries during rollback.
