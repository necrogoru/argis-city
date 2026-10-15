# Tasks

## 1. App-wide view shortcuts

- [x] 1.1 Add app-shell shortcut handling for Dashboard and Tasks with macOS Command and non-macOS Control bindings; verify shortcut-matching tests cover both platforms, repeated keys, editable controls, and terminal focus.
- [x] 1.2 Wire the bindings to the shared app-view state and show discoverable, accessible shortcut hints; verify tests switch views without changing the Dashboard startup default.
- [x] 1.3 Update the navigation portion of `docs/design/SPEC.md`; verify the documented keys, labels, and destination behavior match the implementation.
- [x] 1.4 Add searchable Dashboard and Tasks actions to `⌘K`, linked to the shared app-view state and showing shortcut hints; verify matching, activation, and platform labels in tests and document the actions in `docs/design/SPEC.md`.

## 2. Task search in the command palette

- [x] 2.1 Add cached task/project search data that loads without per-task Git status checks and is invalidated after task or project mutations; verify store tests cover loading, reuse, and invalidation.
- [x] 2.2 Extend pure palette search and result handling for task ID, title, description, and project path while preserving agent/action results and keyboard navigation; verify search tests cover matching, ranking, empty results, and selection.
- [x] 2.3 Update the palette/task-search portion of `docs/design/SPEC.md`; verify it describes the result context and no-match behavior implemented in the palette.

## 3. Open task terminals without changing views

- [x] 3.1 Move terminal target state and the modal host to the app shell, and route both palette and task-board actions through it; verify UI tests open from Dashboard without changing the active view and preserve the current view when closing.
- [x] 3.2 Verify terminal search results reattach existing Agent/shell sessions or expose the existing start controls when no session is running; verify tasks without worktrees remain searchable, show the unavailable reason and explicit Tasks action, and never create Git resources during search.
- [x] 3.3 Update the terminal/search portion of `docs/design/SPEC.md`; verify the documented reattach, no-session, and no-worktree behaviors match the implementation.

## 4. Dashboard terminal navigation

- [x] 4.1 Remove Command+1/Command+2 and Control+1/Control+2 handling and stale shortcut hints; verify shortcut tests confirm no view switch while palette Dashboard/Tasks actions remain available.
- [x] 4.2 Add a typed Argis-managed terminal inventory to the Rust manager, Tauri command, and mock/Tauri AgentSource implementations; verify tests report task/tab state without discovering external processes and document the transport in `docs/CONTRACT.md`.
- [x] 4.3 Add the app-level terminal index rail and state aggregation; verify idle, pending, running, completed, and unavailable states, hover/focus expansion, and click-to-open on the Agent tab.
- [ ] 4.4 Match selected-house cwd to normalized task worktree paths and expose Terminal only for a matching Argis terminal; verify match/no-match cases and that the Dashboard lookup does not run Git status checks or change views.
- [ ] 4.5 Update `docs/design/SPEC.md` with the removed numeric shortcuts, rail, status behavior, and selected-house Terminal action; verify labels and state descriptions match the implementation.

## 5. Integration verification

- [ ] 5.1 Run `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; manually verify palette task search, Dashboard startup, numeric shortcut removal, rail behavior, selected-house matching, and uninterrupted city monitoring.
