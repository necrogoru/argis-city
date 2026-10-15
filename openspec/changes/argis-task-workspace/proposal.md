# Proposal

## Why

The task workspace currently relies on its filter, buttons, and task cards for navigation. Keyboard-first search and focused-task actions reduce friction when moving from a task list into its isolated branch and terminal, while direct terminal controls keep the Agent and shell tabs usable without returning to the pointer.

## What Changes

- Add task search within the Tasks workspace and let ↑/↓ move focus through matching tasks.
- Add `c` to open the existing New task flow; when a task is focused, `b` invokes its existing branch action and `t` invokes its existing terminal action.
- Make keyboard task actions preserve the existing Git/worktree availability checks and never create Git resources as a side effect of searching or navigation.
- In the terminal modal, Escape closes the modal; Ctrl+Tab switches between Agent (harness) and `term` (shell), focusing the active terminal input when opened or switched.
- Preserve task data, Dashboard startup, and terminal process lifecycle.

## Capabilities

### New Capabilities

- `project-task-management`: Maintain local projects and tasks, and find/navigate/act on tasks with keyboard controls.
- `task-git-worktrees`: Create and associate a task-specific Git branch and worktree; detect unavailable Git/branches and handle optional cleanup on task deletion.
- `embedded-terminal-sessions`: Run task Agent/shell terminals, preserve their sessions, and control the modal and tabs from the keyboard.

### Modified Capabilities

None. The project has no main OpenSpec capability specs yet; these behaviors are captured as new capabilities.

## Impact

- Frontend: task-board search/focus state, task-card keyboard actions, and terminal-modal key handling/input focus.
- Existing task store, Git worktree service, and terminal transport are reused; no new dependency or backend command is expected for these keyboard interactions.
- Tests and design documentation: cover filtered task navigation, action guards, modal close/tab switching, and focus restoration.
