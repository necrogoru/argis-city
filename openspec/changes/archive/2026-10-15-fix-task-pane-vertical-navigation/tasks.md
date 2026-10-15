# Tasks

## 1. Bound vertical task navigation to each pane

- [x] 1.1 Replace flattened, wrapping vertical target resolution with a per-column adjacent-task resolver; add tests for both directions, first/last boundaries, empty panes, and filtered visible tasks, then verify `pnpm exec vitest run src/domain/taskFocus.test.ts` passes.
- [x] 1.2 Wire focused-card ArrowUp/ArrowDown and `k`/`j` movement through the per-column resolver while preserving horizontal navigation and search-field first/last behavior; update the corresponding keyboard rule in `docs/design/SPEC.md` and verify the relevant domain tests pass.

## 2. Add Vim first/last motions

- [x] 2.1 Add pure shortcut resolution for `gg` and uppercase `G`, including the 500 ms double-`g` window and existing editor/dialog/composition guards; test eligible, expired, interrupted, modified, repeated, composing, and empty-board cases with `pnpm exec vitest run src/domain/taskBoardShortcuts.test.ts`.
- [x] 2.2 Wire the resolved motions to focus the first or last currently visible task; update task-card `aria-keyshortcuts`, the search field’s keyboard help, and the matching `docs/design/SPEC.md` section, then verify `pnpm build` and the targeted shortcut tests pass.

## 3. Run repository integration gates

- [x] 3.1 Verify the complete frontend build and test suite with `pnpm build` and `pnpm exec vitest run`.
- [x] 3.2 Verify Rust and formatting gates with `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`.
