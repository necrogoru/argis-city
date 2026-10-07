---
description: Add support for another coding-agent tool, backend to city
argument-hint: <tool name, and where it keeps its sessions if known>
---

Add an Argis provider for: $ARGUMENTS

## Before writing code

1. Read `AGENTS.md`, `.agents/context/architecture.md` and `docs/CONTRACT.md`.
   Load the `rust-best-practices` and `tauri` skills.
2. Pick the existing provider closest in shape and read it end to end:
   JSONL per session → `providers/pi/` (simplest) or `providers/claude/`;
   SQLite index → `providers/codex/` or `providers/opencode/`.
3. Inspect the tool's on-disk state on this machine, **read-only** (copy
   SQLite files to a scratch dir before you open them). Work out the live
   signal (owning process, registry file, recent writes), tokens, context
   window, plan or todo source, status, and subagents.
4. Write the detection rules as a new section under "Detection rules per
   provider" in `docs/CONTRACT.md`, then **stop and show them to the user.**
5. The city is a 2×2 diamond with four `TowerSlot`s, all taken. A fifth tower
   needs a layout change (`domain/providers.ts`, `scene/layout.ts`, camera
   framing). Propose the layout and wait for approval before coding it.

## Backend (`src-tauri/src/`)

- `domain/provider.rs`: add a `ProviderId` variant and its `as_str`.
- `system/paths.rs`: add a `HomePaths` field for the tool's data dir, set in `from_home`.
- `providers/<id>/mod.rs`: `impl AgentProvider`. Reuse `shared::jsonl::JsonlTailCache`,
  `shared::liveness`, `shared::sqlite::open_read_only` and `shared::text`
  instead of writing new readers.
- `providers/mod.rs` and `lib.rs`: declare the module and register it in `build_registry`.
- `providers/<id>/tests.rs`: build fixtures in a `tempfile` dir and cover
  liveness, each status, token sums, the plan, and a malformed or partial line.

## Frontend (`src/`)

- `domain/types.ts`: extend the `ProviderId` union.
- `domain/providers.ts`: add an entry to `PROVIDERS` and `PROVIDER_ORDER`
  (label, colour, slot).
- Colour: a new token in `styles/tokens.css` and `domain/palette.ts`, and in
  `docs/design/SPEC.md`. Ask the user to pick the colour.
- `services/mock/mockSeed.ts`: add demo sessions so `pnpm dev` shows the new tower.
- Copy that lists the tools by name: `ui/EmptyState.vue`, `ui/AgentList/AgentList.vue`.

## Verify

- `cargo run --manifest-path src-tauri/Cargo.toml --example dump_snapshot`
  shows the tool's live sessions with sensible status, tokens and progress.
  Check the warm collect time too.
- The full gate from `AGENTS.md` passes.
- `pnpm tauri dev`: the tower and its houses appear, and hover, select, ⌘K
  search and Escape all work for the new sessions.
