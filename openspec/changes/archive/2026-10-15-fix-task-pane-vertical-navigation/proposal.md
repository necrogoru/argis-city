# Proposal

## Why

Vertical navigation on the task board currently follows one flattened list, so ArrowUp/ArrowDown and `j`/`k` can unexpectedly carry focus into a pane to the left or right. Keep vertical movement within the focused status pane, and add familiar Vim motions for jumping to the board’s first or last visible task.

## What Changes

- Keep ArrowUp/ArrowDown and `k`/`j` within the focused task’s current status pane; stop at that pane’s first and last visible task instead of wrapping or crossing panes.
- Add `gg` to focus the first visible task and `G` to focus the last visible task in filtered board order.
- Preserve existing horizontal navigation (`ArrowLeft`/`ArrowRight`, `h`/`l`), search behavior, and safeguards for editable controls and open dialogs.
- Update the task-workspace keyboard-navigation contract and its design documentation.

## Capabilities

### New Capabilities

- `task-board-keyboard-navigation`: Defines vertical, horizontal, and first/last keyboard navigation across the filtered task board.

### Modified Capabilities

None. The project has no main OpenSpec capability specs yet; this change introduces a focused task-board navigation capability.

## Impact

- Frontend navigation logic and tests in `src/domain/taskFocus.ts` and `src/domain/taskBoardShortcuts.ts`.
- Keyboard handling and shortcut semantics in `src/ui/Tasks/TaskBoard.vue` and `src/ui/Tasks/TaskCard.vue`.
- The task-workspace keyboard-navigation section of `docs/design/SPEC.md`.
- No backend, wire-contract, or dependency changes are expected.
