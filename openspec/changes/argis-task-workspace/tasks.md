# Tasks

## 1. Local project and task data

- [x] 1.1 Add Rust and TypeScript project/task types plus the versioned app-owned SQLite store; verify CRUD, stable generated IDs, status persistence, and restart restoration with Rust tests using temporary database paths.
- [x] 1.2 Implement project path validation, existing-directory registration, and explicit missing-directory creation; verify valid, relative, non-directory, and uncreatable paths with temporary-directory tests.
- [x] 1.3 Expose project/task persistence through Tauri commands and the injected `AgentSource` Tauri/mock implementations; document the transport contract and verify `pnpm build` plus command/service tests.

## 2. Task workspace and board

- [x] 2.1 Implement pure task status-order, previous/next transition, grouping, and project-filter helpers; verify all five statuses, three groups, filter behavior, and boundary-disabled actions with colocated Vitest tests.
- [x] 2.2 Add a Pinia task store over the injected service and cover load/create/edit/status/delete state transitions; verify the store tests use the mock service and preserve task IDs on edits.
- [x] 2.3 Add the optional Tasks entry point and dedicated task workspace while retaining the city as the startup view; verify navigation and return-to-city behavior in browser mock mode without changing snapshot polling.
- [x] 2.4 Build the project list/path form and task board with project filtering, task create/edit panels, and the four agreed task actions; verify the layout and interactions manually at the documented desktop size and update `docs/design/SPEC.md` without changing existing tokens.
- [x] 2.5 Add a pure task-search helper matching ID, title, description, project name, and path; verify matching, project-filter intersection, grouped order, and no matches with Vitest.
- [x] 2.6 Add task search and arrow-key focus navigation through visible matches; verify focus transitions, filtered-result boundaries, and focus handling when results change.
- [x] 2.7 Add `c`/`b`/`t` handlers using existing create/branch/terminal actions; verify editable/dialog guards, disabled-action behavior, and no implicit Git side effects.
- [ ] 2.8 Update `docs/design/SPEC.md` for task search, arrow navigation, and single-key actions; verify the documented key behavior and guards match the implementation.
## 3. Git task worktrees

- [x] 3.1 Implement validated Git repository/branch checks and task branch/worktree creation using the agreed names and path; verify successful creation, non-Git projects, branch collisions, unusual task titles, and the local exclude rule with temporary Git repositories.
- [x] 3.2 Implement optional worktree/branch cleanup without force removal and without blocking task-record deletion; verify clean cleanup, declined cleanup, and dirty-worktree retention with temporary Git repositories.
- [x] 3.3 Implement task deletion confirmation and the keep-or-remove-Git-resources choice; verify task deletion remains available when Git cleanup is declined or reports an error.
- [x] 3.4 Expose Git capability and error state through the Tauri/mock transport and task cards; verify disabled states and user-facing explanations for non-Git projects and existing branches.
- [x] 3.5 Document Git commands, side effects, and cleanup behavior in the transport/architecture documentation; verify the documented branch and worktree conventions match the tests.

## 4. Embedded terminal sessions

- [x] 4.1 Compare maintained Rust PTY and Vue-compatible terminal-renderer options, then obtain explicit approval for the chosen dependencies and any Tauri permission/configuration changes before installing them; verify the decision and approved scope are recorded.
- [x] 4.2 Implement a backend terminal process manager with start, input, resize, output, reattach, and shutdown operations behind the approved PTY adapter; verify lifecycle and error handling with controlled test processes.
- [x] 4.3 Build the large terminal modal with Agent and `term` tabs and a terminal renderer; verify it opens over the task workspace, closes back to the board, and does not directly depend on Tauri APIs.
- [x] 4.4 Implement the agent chooser (Claude Code default), agent/shell startup in the task worktree, background reattachment with recent output restoration, missing-CLI errors, and app-exit cleanup; stop and reap task sessions before task deletion, abort deletion if stopping fails, use a monospace xterm font with zero letter spacing, and verify reattach content, shell usability after an agent launch error, and process cleanup.
- [x] 4.5 Document terminal commands/channels, bounded output replay, font choice, and lifecycle in `docs/CONTRACT.md` and architecture context; verify the transport contract matches both Tauri and mock implementations.
- [ ] 4.6 Add Ctrl+Tab tab switching and active xterm input focus on open/switch; verify both directions, Escape close, focus restoration, and that terminal processes remain alive after close. Update `docs/design/SPEC.md` with the terminal keyboard behavior.

## 5. Integration verification

- [ ] 5.1 Verify the task and terminal workflows do not regress monitoring by running `pnpm build`, `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; manually check task search, arrow navigation, `c`/`b`/`t`, text-entry guards, Escape, Ctrl+Tab focus, terminal persistence, and city/task navigation in the desktop app.
- [x] 5.2 Re-run `openspec validate argis-task-workspace --strict` against the revised artifacts and resolve any findings before implementation is considered ready.
