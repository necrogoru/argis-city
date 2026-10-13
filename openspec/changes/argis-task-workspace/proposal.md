# Proposal

## Why

Argis monitors live coding-agent sessions but does not let users organize their own work into project-linked tasks or launch an isolated workspace for a task. Adding this as an optional workflow gives users a way to move from planning to agent work without displacing the city as Argis’s primary monitoring view.

## What Changes

- Add a local project and task manager with a dedicated workspace, project-path registration/creation, generated task IDs, editable task details, and manually updated statuses.
- Group tasks into pending, in-progress, and other-status sections, with project filtering and explicit status labels.
- Let a task create its Git branch and worktree, then open an embedded two-tab terminal at that worktree: a user-selected supported agent CLI (Claude by default) and a shell.
- Keep terminal sessions alive while users switch back to monitoring; stop them when Argis exits. Make task deletion independent of optional Git cleanup, and ask before removing a task’s branch and worktree.
- Keep task/project data local to Argis and independent of the read-only coding-agent observers. Do not import coding-agent plans or add cross-device sync.

## Capabilities

### New Capabilities

- `project-task-management`: Maintain local projects and user-authored tasks, edit task details, update statuses, and browse/filter the grouped task board.
- `task-git-worktrees`: Create and associate a task-specific Git branch and worktree; detect unavailable Git/branches and handle optional cleanup on task deletion.
- `embedded-terminal-sessions`: Run agent and shell terminal tabs in a task worktree, preserve sessions while switching views, and stop them when Argis exits.

### Modified Capabilities

None.

## Impact

- Frontend: new task/project domain types, data-service boundary, workspace UI, and terminal rendering integrated alongside the existing monitoring view.
- Backend: Argis-owned local task/project persistence, Tauri commands, Git worktree operations, and managed interactive terminal processes.
- Tauri security/configuration and dependencies may need changes for project-path validation and PTY/terminal support; review these explicitly before implementation. The existing agent providers remain read-only and the current monitoring experience remains the default.
- Tests: frontend domain/service tests and Rust tests for persistence, Git operations, and process/terminal lifecycle.
