# Proposal

## Why

The Tasks view already groups work by status and supports keyboard actions, but nested lane/card boundaries make the board feel over-divided, status cues could scan more clearly, and keyboard commands are hidden from sighted users. A focused visual refinement can borrow the reference's open, evenly distributed board structure while preserving Argis's dark visual system and keeping the change confined to Tasks.

## What Changes

- Refine Tasks-view spacing and remove redundant lane and card-action dividers, using whitespace, lane headings, and task cards to establish hierarchy.
- Make the existing semantic task-status colors easier to scan without tinting entire cards or changing the global palette.
- Add a brief, non-layout-shifting status-change transition that respects reduced-motion preferences.
- Show a compact keyboard shortcut legend at all times below the board toolbar, including navigation, first/last-task, and task-action shortcuts.
- Preserve current text contrast requirements and allow the shortcut legend to wrap at narrow widths.

## Capabilities

### New Capabilities

- `task-board-presentation`: Define the Tasks board's visual grouping, status cues, contrast, motion, and visible keyboard-shortcut guidance.

### Modified Capabilities

None.

## Impact

- Frontend: `src/ui/Tasks/TaskBoard.vue` and `TaskCard.vue`; reuse the existing `Kbd` component and design tokens without changing global tokens.
- Documentation: update `docs/design/SPEC.md` to reflect the approved Tasks-view treatment.
- Tests: cover shortcut-hint content/layout behavior and status-change feedback where supported by the existing frontend test setup.
- No backend, transport, database, dependency, or Tauri permission changes.
