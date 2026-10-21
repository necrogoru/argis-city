# Proposal

## Why

Argis is keyboard-first, but switching between Dashboard and Tasks still requires the command palette or the pointer. Vim-style `g`-prefixed chords make that navigation available from either view without leaving the keyboard, and a more deliberate terminal-close chord avoids sending `Ctrl+Shift+W` to terminal applications. The palette's most useful task action is also hidden behind a query today, even though New task is the natural starting point for the Tasks workspace.

## What Changes

- Add unmodified `g d` (Dashboard) and `g t` (Tasks) view-navigation chords. The chord must complete within 500 ms, ignore modified/repeated/composing key events, and stay inactive while any modal dialog (including the terminal modal) is open or focus is in an input, textarea, select, contenteditable element, or xterm input.
- Make the chord consume its second key so the Tasks board does not also run a single-key action: `g t` on Tasks stays on Tasks instead of opening the focused task's terminal, and `g d` leaves Tasks for Dashboard. Preserve the task board's existing `gg` and `Shift+G` motions.
- **BREAKING**: Replace the terminal modal's `Ctrl+Shift+W` close chord with `Ctrl+Esc`. `Ctrl+Esc` closes from any focus target, including terminal input. Escape keeps its current behavior: it is passed to xterm while terminal input is focused and closes the modal when focus is elsewhere.
- Add the existing Create task action to the command palette's empty-query defaults, after Open Tasks and Show Dashboard. Keep the action disabled while no project is registered and keep the existing searchable behavior and ordering for non-empty queries.
- Refresh the terminal footer hint, accessible shortcut metadata, shortcut/unit tests, and the relevant design documentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-view-navigation`: Add `g`-prefixed primary-view navigation and its blocking/consumption rules.
- `embedded-terminal-sessions`: Replace the terminal modal close chord and clarify the Escape pass-through behavior.
- `command-palette-search`: Include Create task among the actions shown for an empty query.

## Impact

- Frontend only: `src/domain/appViewShortcuts.ts`, `src/composables/useAppViewShortcuts.ts`, `src/domain/terminalNavigation.ts`, `src/ui/Tasks/TerminalModal.vue`, `src/ui/CommandPalette/paletteResults.ts`, and their colocated tests.
- Documentation: `docs/design/SPEC.md` shortcut and command-palette sections.
- No backend, transport, dependency, or persisted-data changes. Existing terminal sessions and task behavior are unchanged.
