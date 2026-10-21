# Tasks

## 1. G-prefixed view navigation

- [x] 1.1 Replace the always-null `appViewForShortcut` matcher with a pure `resolveAppViewChord` resolver in `src/domain/appViewShortcuts.ts` that tracks a 500 ms `g` prefix, resolves `g d`/`g t`, and reuses `isViewShortcutBlocked` for dialog, editor, and xterm guards; verify with unit tests covering both targets, timeout, unrelated keys, modifiers, repeat/composition, blocked dialogs, and editable targets.
- [x] 1.2 Wire `src/composables/useAppViewShortcuts.ts` to the resolver, keep the pending prefix in composable scope, and prevent default only when a chord completes; verify `pnpm build` type-checks the composable and resolver tests cover the state transitions.
- [x] 1.3 Add a `defaultPrevented` guard to `taskBoardActionForShortcut` in `src/domain/taskBoardShortcuts.ts` so a consumed `t` cannot open a task terminal; verify existing `b`/`c`/`t`/`s` mappings still pass and a prevented `t` resolves to `null` in `src/domain/taskBoardShortcuts.test.ts`.
- [x] 1.4 Update the app-navigation and task-board shortcut sections of `docs/design/SPEC.md` with `g d`, `g t`, the 500 ms window, the terminal/editor/dialog guards, and the task-board precedence rule; verify the documented keys and blocked contexts match the implemented behavior.

## 2. Terminal close chord

- [x] 2.1 Replace the Ctrl+Shift+W branch with Ctrl+Esc in `shouldCloseTerminalModalForKey` in `src/domain/terminalNavigation.ts`; verify tests cover Ctrl+Esc from terminal input and modal controls, Ctrl+Shift+W no longer closing, and the existing Escape pass-through/close split.
- [x] 2.2 Update `src/ui/Tasks/TerminalModal.vue` so `aria-keyshortcuts` exposes Escape and Control+Escape and the footer hint reads “Ctrl+Esc closes · Escape goes to terminal when focused”; verify `pnpm build` succeeds and the rendered hint matches the helper behavior.
- [x] 2.3 Update the terminal keyboard-behavior section of `docs/design/SPEC.md` to replace Ctrl+Shift+W with Ctrl+Esc and preserve the Escape pass-through note; verify the design text matches the implementation and tests.

## 3. Create task in the palette defaults

- [x] 3.1 Add `create-task` to the empty-query defaults in `src/ui/CommandPalette/paletteResults.ts`, after `view:tasks` and `view:city`; verify `src/ui/CommandPalette/paletteResults.test.ts` asserts the three-action order and that non-empty ranking is unchanged.
- [x] 3.2 Verify the default Create task row preserves its existing disabled state and activation guard when no project is registered, and still opens the New task editor when projects are available; confirm with `src/composables/useCommandActions.test.ts` and manual palette behavior.
- [x] 3.3 Update the command-palette section of `docs/design/SPEC.md` to list Open Tasks, Show Dashboard, and Create task as the empty-query actions; verify the documented order and disabled behavior match the palette.

## 4. Integration verification

- [x] 4.1 Run `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; verify all pass.
- [x] 4.2 Manually verify `g d` and `g t` from both views, blocked chords while the terminal modal or an editor has focus, `gg` still focusing the first task, `g t` not opening the focused task terminal, Ctrl+Esc closing the terminal from terminal input, Ctrl+Shift+W not closing it, Escape still reaching xterm, and the palette's three default actions including a disabled Create task with no projects.
