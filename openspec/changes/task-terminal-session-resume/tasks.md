# Tasks

## 1. Persist task-scoped resume metadata

- [x] 1.1 Add an additive TaskStore migration for one latest agent resume reference per task, including provider, opaque native reference, canonical worktree path, and last-observed time; verify insert, replacement, migration from existing databases, and deletion with Rust tests using temporary databases.
- [x] 1.2 Add typed Rust/TypeScript resume metadata and TaskStore operations, then expose them through Tauri and mock `AgentSource` implementations; verify serialization, persistence round trips, and mock/Tauri contract parity with tests.

## 2. Identify and relaunch provider-native sessions

- [x] 2.1 Verify the native session-reference discovery and resume invocation supported by Claude, Codex, OpenCode, and Pi; record a provider support matrix and tests showing unsupported or ambiguous providers report resume unavailable rather than guessing.
- [x] 2.2 Add provider-specific adapters that associate only an unambiguous Argis-launched Agent process with its native session reference and persist it; verify adapter behavior with provider fixtures, same-worktree concurrent-session cases, and no-reference fallbacks.
- [ ] 2.3 Add a resume launch mode that constructs provider arguments directly, validates the stored reference and canonical task worktree, and rejects stale or mismatched references; verify successful resume, invalid identifiers, and path-mismatch cases with backend tests.
- [ ] 2.4 Make Agent shutdown attempt a bounded graceful interrupt before forced termination, retaining the existing stop-and-reap guarantee; verify clean exit, timeout escalation, and no indefinite wait with controlled-process tests.
- [ ] 2.5 Update `docs/CONTRACT.md` for resume metadata, transport, provider support/fallback, and shutdown behavior; verify the documented payloads and lifecycle match Rust and TypeScript tests.

## 3. Add the shared resume-or-new UI flow

- [ ] 3.1 Update the terminal modal to reattach directly when a live Agent PTY exists and otherwise show `Resume <provider>` plus `Start new`; verify the branch conditions, provider label, unsupported state, and new-session CLI selection with colocated frontend tests.
- [ ] 3.2 Feed durable resume availability into the Dashboard terminal rail while retaining live-process status; verify a resumable task remains listed after a simulated app restart and external terminals remain excluded.
- [ ] 3.3 Route task-board `t`, Dashboard launcher, and matching selected-house Terminal actions through the same task-scoped resume flow without changing the active app view; verify each entry point opens the same task and respects worktree matching.
- [ ] 3.4 Update `docs/design/SPEC.md` for resume choice, Dashboard resumable state, and the distinction between conversation resume and PTY restoration; verify the documented shortcuts and states match the UI behavior.

## 4. Lifecycle and integration verification

- [ ] 4.1 Remove saved resume metadata only after managed PTYs stop successfully during task deletion; verify stop failure preserves the task and reference, and successful deletion removes both with Rust tests.
- [ ] 4.2 Run `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; manually verify live reattachment, app-restart resume, Start new, stale-reference fallback, all three entry points, and task deletion.
