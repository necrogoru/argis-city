# Tasks

## 1. Track observed harness transitions

- [x] 1.1 Add a pure session/subagent transition tracker that baselines the first snapshot, detects approval entry and running-to-idle/done transitions, and preserves state when a provider reports an error; verify it with unit tests for baseline, new waiting sessions, repeated snapshots, completion, errors, and disappearance.
- [x] 1.2 Connect accepted snapshots to the app-lifetime alert coordinator without coupling logic to a view; verify snapshot-store/coordinator tests show transitions once across Dashboard and Tasks view changes.

## 2. Publish managed terminal exits app-wide

- [x] 2.1 Broadcast a typed terminal lifecycle event from the PTY manager's actual exit path, separate from xterm output Channels; verify Rust tests cover exit payloads and one event per process exit.
- [x] 2.2 Add the lifecycle event subscription to `AgentSource` and both live/mock implementations, and document the event in `docs/CONTRACT.md`; verify source tests and contract names/payloads match the Rust and TypeScript wire types.

## 3. Deliver sound and desktop notifications

- [x] 3.1 Obtain the user's explicit approval before adding a Tauri notification dependency/plugin or capability permission; verify approval is recorded before editing dependency or capability files.
- [x] 3.2 Implement an isolated notification and sound delivery service, including the approved native notification permission flow and sound fallback; verify tests cover successful delivery, denied/unavailable notification permission, and delivery failure isolation.

## 4. Integrate alert routing and deduplication

- [x] 4.1 Connect session transitions and app-wide terminal exits to one app-lifetime coordinator, resolve task/harness labels, and suppress duplicate managed-Agent completion alerts when both sources describe the same worktree run; verify coordinator tests for source overlap and independent shell exits.
- [x] 4.2 Run the full project gates (`pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`) and manually verify approval/completion/terminal-exit alerts from both app views and while the window is backgrounded on macOS.
