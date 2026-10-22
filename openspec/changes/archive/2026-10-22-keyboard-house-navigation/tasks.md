# Tasks

## 1. House cursor model and lifecycle

- [x] 1.1 Add a pure house-navigation resolver for stable city order, direction, selected-house anchoring, first/last initialization, wrapping, and empty input; add unit tests for each case and verify with `pnpm exec vitest run src/domain/houseNavigation.test.ts`.
- [x] 1.2 Add transient keyboard-cursor state separate from committed selection, clearing it on commit, Escape, candidate removal from a snapshot, and leaving Dashboard; add store tests for these transitions and verify with `pnpm exec vitest run src/stores/selection.test.ts`.

## 2. Dashboard keyboard interaction

- [x] 2.1 Wire `h`/`l`, Left/Right Arrow, Enter, and Escape to the city-view interaction context; cover modifiers, repeat/composition, default-prevented events, editable controls, dialogs, terminal inputs, native controls, and terminal-rail exclusion with tests, then verify the relevant Vitest suites pass.
- [x] 2.2 Connect Enter to the existing selected-house action and Escape to the existing one-layer selection escape; verify keyboard browsing leaves selection unchanged until Enter and that Enter opens the selected-house panel and focuses its provider.

## 3. House cursor feedback and accessibility

- [x] 3.1 Pass the temporary cursor state to house presentation and visibly emphasize its label without replacing the selected-house marker; verify both states remain distinct in the Dashboard browser view.
- [x] 3.2 Add a polite live announcement containing the candidate house title and provider, with a unit test for its text; verify the announcement updates while browsing and clears with the cursor.

## 4. Integration verification

- [x] 4.1 Run a browser check with mock Dashboard data for ordering across providers, wraparound, no-house behavior, Enter focus, Escape unfocus, and unchanged terminal-rail/text-entry behavior; record any uncovered case as a regression test.
- [x] 4.2 Run `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; confirm all project gates pass.
