# Design

## Context

See `proposal.md` for motivation and the delta specs for observable requirements. The current implementation has three relevant pieces:

- `src/composables/useAppViewShortcuts.ts` still registers a global key handler, but its matcher in `src/domain/appViewShortcuts.ts` always returns `null` after numeric view bindings were removed. `isViewShortcutBlocked` already centralizes the editor, dialog, and xterm guards.
- `src/ui/Tasks/TaskBoard.vue` installs its own window `keydown` listener. Its `g`-prefix state machine (`resolveTaskBoardJumpShortcut`, 500 ms) powers `gg`, and its single-key actions include `t` for opening the focused task’s terminal.
- `src/ui/Tasks/TerminalModal.vue` delegates close decisions to `shouldCloseTerminalModalForKey`, exposes `aria-keyshortcuts="Control+Shift+W"`, and shows a matching footer hint.
- `src/ui/CommandPalette/paletteResults.ts` hardcodes the empty-query defaults as `["view:tasks", "view:city"]`; the existing `create-task` action already carries its disabled state from the task store.

## Goals / Non-Goals

**Goals:**

- Add a pure, testable `g`-chord resolver with the same timing and guard behavior as the existing task-board prefix.
- Guarantee that completing a view chord never also triggers a task-board single-key action.
- Keep one source of truth for the terminal close chord in the pure domain helper and update every surfaced hint from it.
- Add Create task to the palette defaults without changing search ranking, result selection, or task-creation flow.

**Non-Goals:**

- Building a general configurable keybinding system or an app-wide shortcut registry.
- Changing dashboard/task layout, terminal process ownership, or task persistence.
- Changing the task board’s `gg`, `Shift+G`, or single-key semantics.
- Adding new dependencies, backend commands, or transport changes.

## Decisions

### Resolve view chords in the domain layer

Add a pure resolver to `src/domain/appViewShortcuts.ts` with the shape `resolveAppViewChord(event, target, hasOpenDialog, pendingGAtMs, nowMs) → { view, pendingGAtMs }`.

- An unmodified lowercase `g` starts or refreshes the 500 ms prefix but is not consumed, so the task board still sees it and can build its own `gg` sequence.
- An unmodified `d` or `t` within the window resolves to `city` or `tasks` and clears the prefix.
- Modified, repeated, composing, already-handled, blocked, or expired events return no view and clear the prefix.
- The guard reuses `isViewShortcutBlocked`, so an open dialog (including the terminal modal and command palette) or an editable/xterm focus target disables the chord.

*Alternative considered:* teaching the task board about `g d`/`g t`. Rejected because the chord is app-level, must work on Dashboard too, and would duplicate the guard and timing logic.

### Consume only the completing key

`useAppViewShortcuts` will replace its always-null predicate with one `onKeyStroke` callback that owns the pending-prefix timestamp in composable scope. When a chord resolves, it calls `preventDefault()` and switches views.

The task board will gain a `defaultPrevented` check in `taskBoardActionForShortcut` (and its event type). This ensures `g t` on Tasks cannot open the focused task’s terminal after the app handler consumes the `t`, while `resolveTaskBoardJumpShortcut` already clears the board’s pending `g` for handled events. The global `g` key remains untouched so `gg` still works.

*Alternative considered:* calling `stopImmediatePropagation()`. Rejected because it can leave the board’s pending prefix uncleared and makes behavior depend on listener registration order.

### Replace the terminal close chord in the pure helper

`shouldCloseTerminalModalForKey` will treat unmodified Ctrl+Esc as a close chord from any focus target, including xterm input, and stop treating Ctrl+Shift+W as a close chord. Plain Escape keeps its current split behavior: passed to xterm while terminal input is focused, close otherwise.

`TerminalModal.vue` will update its accessible shortcut metadata to expose both Escape and Ctrl+Esc, and its footer hint will read “Ctrl+Esc closes · Escape goes to terminal when focused.” The modal already prevents default and stops propagation when the helper returns true, so no event-flow change is needed.

### Append Create task to the palette defaults

`buildPaletteResults` will use `["view:tasks", "view:city", "create-task"]` for an empty query. The action is already produced by `useCommandActions` with its disabled state, so no new availability logic is needed. Appending preserves the existing first two default rows; a missing create action is simply omitted, matching the current behavior for missing view actions.

*Alternative considered:* putting Create task first. Rejected because the existing default order is intentional and the request did not ask to reorder the navigation actions.

## Risks / Trade-offs

- **`gg` and the new `g` chord share a prefix** → Do not consume the first `g`; let both state machines observe it, and only consume the completing `d`/`t`. Cover `gg` in tests to prevent regression.
- **The board might act on `t` before the app handler** → Add an explicit `defaultPrevented` guard to the board’s action resolver and test it. The app-level listener is registered before the board in Argis’s Dashboard-first startup flow.
- **Ctrl+Esc can be an OS-level shortcut on non-macOS platforms** → Argis targets macOS; record the platform assumption and avoid adding a conflicting global system binding.
- **A 500 ms prefix can feel slow or fast** → Match the existing `gg` window so both keyboard sequences share one rhythm.
- **The palette’s empty-query list grows** → Keep it to the three existing actions in a fixed order and leave non-empty fuzzy ranking unchanged.

## Migration Plan

No data or backend migration is required. Ship the frontend change with updated unit tests and `docs/design/SPEC.md`. Rollback restores the previous shortcut helper, palette defaults, and documentation; no persisted state is affected.
