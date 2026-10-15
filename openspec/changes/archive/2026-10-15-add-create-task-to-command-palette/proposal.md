# Proposal

## Why

The command palette can find tasks and navigate to the Tasks workspace, but creating a task still requires leaving the current view and starting from the board. Adding a direct creation action makes the existing task workflow available from the same keyboard-first entry point.

## What Changes

- Add a searchable **Create task** command-palette action.
- Selecting it opens the existing New task editor in the Tasks workspace; it does not create a task without the user's normal form submission.
- Keep the action discoverable but disabled until at least one project is registered, matching the Tasks board's existing New task availability.

## Capabilities

### New Capabilities
- `command-palette-task-creation`: Start the existing task-creation flow from the command palette.

### Modified Capabilities
- None.

## Impact

- Frontend command action and palette option behavior in `src/composables/useCommandActions.ts` and `src/ui/CommandPalette/`.
- Task workspace/editor handoff in `src/ui/Tasks/TaskBoard.vue` and its owning view state.
- Frontend unit tests for command matching, action availability, and task-editor launch behavior.
- No backend/API changes or new dependencies.
