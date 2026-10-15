# Tasks

## 1. Fuzzy matching and relevance

- [x] 1.1 Add domain tests for case-insensitive subsequence matches, per-token matching, rejection when a token is missing, and stronger-versus-weaker match ordering; verify the new fuzzy cases fail against the current matcher while existing search tests remain understood.
- [x] 1.2 Extend the pure search helpers to score subsequence matches while preserving field weights and deterministic tie ordering; verify with `pnpm exec vitest run src/domain/search.test.ts`.

## 2. Palette defaults and unified results

- [x] 2.1 Add a pure palette-results composition helper and tests that assert the empty-query result is exactly Open Tasks then Show Dashboard, and that non-empty agent, task, and action results share one relevance order; verify with `pnpm exec vitest run src/ui/CommandPalette/paletteResults.test.ts`.
- [x] 2.2 Integrate the composed results into `PaletteBody.vue`, retaining type-specific rows and existing arrow/Enter activation; verify the relevant Vitest tests pass and that no-match and clearing-query states follow the spec.
- [x] 2.3 Update the command-palette section of `docs/design/SPEC.md` for the two blank-query actions and globally ranked typed results; verify the documented behavior matches the change spec without changing approved tokens or modal geometry.

## 3. Integration verification

- [x] 3.1 Smoke-test the palette with `pnpm dev`: confirm the blank-query order, a fuzzy query's strongest result appears first across result types, and keyboard selection still activates results.
- [x] 3.2 Run the project gates and confirm they pass: `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`.
