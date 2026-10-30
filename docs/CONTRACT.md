# Argis — backend ⇄ UI contract

Argis renders every coding-agent session running on this machine as a 3D city:
one tower per tool (provider), one house per live session, subagents as cards.

## Transport

| Kind    | Name                      | Payload / return                                  |
| ------- | ------------------------- | ------------------------------------------------- |
| command | `get_snapshot`            | → `Snapshot` (latest cached)                      |
| command | `refresh_snapshot`        | → `Snapshot` (forces a collect now)               |
| command | `open_path`               | `{ path: string }` → `()` (Finder)                |
| command | `list_projects`           | → `Project[]`                                     |
| command | `register_project`        | `{ path, createIfMissing }` → `Project`           |
| command | `list_tasks`              | `{ projectId: number \| null }` → `Task[]`        |
| command | `list_task_agent_resumes` | → `TaskAgentResume[]`                             |
| command | `get_task_agent_resume`   | `{ taskId }` → `TaskAgentResume \| null`         |
| command | `save_task_agent_resume`  | `{ reference: TaskAgentResume }` → `TaskAgentResume` |
| command | `create_task`             | `{ projectId, title, description, images }` → `Task` |
| command | `update_task_details`     | `{ id, title, description, images }` → `Task`     |
| command | `read_task_image`         | `{ imageId }` → raw `ArrayBuffer`                 |
| command | `read_image_file`         | `{ path }` → `TaskImageFile`                      |
| command | `update_task_status`      | `{ id, status }` → `Task`                         |
| command | `delete_task`             | `{ id, removeGitResources }` → `TaskDeletionOutcome` |
| command | `inspect_task_git_status` | `{ taskId }` → `TaskGitStatus`                    |
| command | `create_task_worktree`    | `{ taskId }` → `TaskWorktree`                     |
| command | `start_terminal_session`  | `{ taskId, tab, agentCli, size, onEvent }` → `TerminalAttachment` |
| command | `resume_task_agent`       | `{ taskId, size, onEvent }` → `TerminalAttachment` |
| command | `reattach_terminal_session` | `{ taskId, tab, size, onEvent }` → `TerminalAttachment \| null` |
| command | `terminal_input`          | `{ sessionId, data }` → `()`                     |
| command | `resize_terminal_session` | `{ sessionId, size }` → `()`                     |
| command | `stop_terminal_session`   | `{ sessionId }` → `()`                            |
| command | `forget_terminal_tab`     | `{ taskId, tab }` → `boolean`                     |
| command | `detach_terminal_session` | `{ taskId, tab, attachmentId }` → `boolean`      |
| command | `list_terminal_inventory` | → `TerminalInventoryEntry[]`                     |
| command | `play_alert_sound`        | → `()` (plays the bundled alert sound)            |
| event   | `agents://snapshot`       | `Snapshot`, emitted every poll (2 s)              |
| event   | `terminal://exited`       | `TerminalLifecycleEvent`, emitted once per managed process exit |

Snapshot, project, task, and terminal wire types live in `src/domain/types.ts`
(TS) and `src-tauri/src/domain/` (Rust). Git operation result types live in
`src-tauri/src/git_worktrees.rs`. Rust wire types serialize with
`rename_all = "camelCase"`; optional fields serialize as `null`, never omitted.
All timestamps are Unix epoch **milliseconds**.

`Project` and `Task` are Argis-owned local records and are not part of the
agent `Snapshot`. Project and task IDs are stable generated integers. Project
paths are absolute canonical paths. Task statuses are `pending`, `inProgress`,
`stopped`, `canceled`, and `completed`; branch and worktree fields are `null`
until created. `register_project` creates a missing directory only when
`createIfMissing` is true. Task status changes are explicit user operations;
agent plan data is not imported into the task list.

`TaskImage` is Argis-owned metadata for an optional image attached to a task:
`id`, `fileName`, `mimeType` (`image/png`, `image/jpeg`, `image/webp`, or
`image/gif`), and `byteSize`. Bytes live under
`<database parent>/task-images/<taskId>/<imageId>`, never in SQLite;
`read_task_image` returns them as raw bytes. `create_task` and
`update_task_details` take the full desired image set as `TaskImageInput[]`
(`imageId` for a kept image, or `dataBase64` for a new one) and apply text,
additions, and removals in one transaction, so a failed save changes nothing.
Limits are 12 images per task, 10 MiB per image, and 30 MiB per task; every MIME
type is sniffed from magic bytes in Rust and a client value that disagrees is
rejected. `read_image_file` is the drag-and-drop path: it validates an absolute
path to a supported file and returns its bytes base64-encoded.

`TaskAgentResume` is Argis-owned metadata keyed by `taskId`, with `provider`, an
opaque `nativeReference`, the canonical `worktreePath`, and
`lastObservedAtMs` (Unix epoch milliseconds). The SQLite table retains only one
latest reference per task and is deleted by the task foreign-key cascade. A
provider reference is not a terminal process ID and does not restore a PTY or
terminal buffer. `save_task_agent_resume` replaces the task's prior reference;
the get/list commands return only references whose task worktree and provider
record still validate. A stale reference is omitted so the UI can offer Start
new without suggesting that resume will work.

Before `delete_task` attempts Git cleanup or removes the task record, it stops
and reaps every active terminal process for that task. If process cleanup fails,
the command errors before changing the task or its Git resources. After sessions
stop, `delete_task` removes the task record even when Git cleanup is declined or
fails. Its result reports which Git resources were removed and any cleanup
error; worktree cleanup never uses force.

`inspect_task_git_status` reports whether a project is a Git working tree, the
task's generated branch and worktree names, branch collision state, whether
creation is available, and the reason when it is not. `create_task_worktree`
creates and records both resources only for an eligible task.

## Task Git semantics

- Branches use `argis/<task-id>-<title-slug>`; worktrees live at
  `<project>/.argis/worktrees/<task-id>-<title-slug>`. The stable task ID keeps
  existing branch and worktree names unchanged when a task title is edited.
- Eligibility checks use `git -C <project> rev-parse --show-toplevel` and
  `git -C <project> show-ref --verify --quiet refs/heads/<branch>`. Creation
  uses `git -C <project> worktree add -b <branch> <path>`.
- Git commands receive validated paths and separate arguments; task text is
  normalized into a branch slug and is never evaluated by a shell.
- Argis adds the project-relative `.argis/worktrees/` path (with a project
  subdirectory prefix when needed) to the repository-local `.git/info/exclude`,
  preserving existing entries. It does not edit the project's tracked
  `.gitignore` or initialize Git in a non-Git project.
- When `removeGitResources` is true, cleanup removes a clean worktree first and
  then runs `git -C <project> branch -d <branch>` (never `-D`). Worktree removal
  uses `git -C <project> worktree remove <path>` without `--force`. If either
  operation fails, the task record is still deleted and `TaskDeletionOutcome.git`
  reports the error and any branch/worktree paths that remain. Declining cleanup
  deletes only the task record and leaves its Git resources untouched.

## Embedded terminal sessions

- Each task has at most one process per tab. A tab id is `agent`, `term`, or a
  numbered extra shell `term-2` … `term-6`: `agent` is fixed, `term` is the base
  shell, and extra shells are created from the modal's `+` action (at most six
  shell tabs including `term`). All process working directories are resolved
  from the task's persisted worktree record; the frontend cannot provide a cwd
  or arbitrary executable. Argis checks that the worktree exists under the
  registered project and that its checked-out branch matches the task's recorded
  branch before starting or reattaching. When the recorded worktree directory
  has been deleted, every tab opens in its existing parent (the task worktree
  root, `<project>/.argis/worktrees`) so the worktree can be restored or cleaned
  up. A recorded path that still exists but is not the task's Git worktree, or
  is on another branch, remains an error; there is no silent fallback. Resuming
  a saved Agent conversation always requires the original worktree.
- Agent executable selection is an allowlist: `claude`, `codex`, `opencode`, or
  `pi`. `agentCli` is required for the Agent tab and `null` for every shell tab.
  The shell uses the user's configured shell (`SHELL`, or `COMSPEC` on Windows).
  Task names and descriptions are never passed as process arguments.
- `start_terminal_session` starts the selected PTY and returns a
  `TerminalAttachment`; if the same agent is already running in that task tab,
  it reattaches to it. A different agent cannot replace a running Agent tab.
  `reattach_terminal_session` returns `null` when that tab has no managed
  process. A completed process is reattached with `running: false` and its exit
  event is replayed.
- `reattach_terminal_session` takes the current viewport `size` (nullable) and
  applies it to the live PTY before its output resumes, so a dialog reopened in
  a differently sized window never leaves the CLI drawing for the window it was
  started in. A PTY that already exited is attached without being resized, and
  the same size is applied when `start_terminal_session` reuses a running tab.
  Sizes that did not change are skipped, so a reattachment does not send a
  redundant `SIGWINCH` that makes the CLI repaint.
- `TerminalAttachment` contains `session` and an opaque `attachmentId`. Detach
  only removes the matching output-channel attachment; it does not stop the
  process. A stale attachment ID cannot detach a newer reattachment.
- `list_terminal_inventory` returns only Argis-managed task tabs from the
  current app session, outside `Snapshot`: `{ taskId, tab, state }` where
  `state` is `running`, `completed`, or `failed`. It never discovers external
  terminals or provider-observed processes. Browser mock mode returns `[]`.
- `onEvent` is a Tauri Channel carrying ordered `TerminalEvent` values:
  `output` has `sessionId` and `bytes` (a JSON byte array), `error` has
  `sessionId` and `message`, and `exited` has `sessionId`, `exitCode`, and a
  nullable `signal`. The UI converts output bytes to `Uint8Array` for xterm.
- `terminal://exited` is broadcast app-wide independently of any attached xterm
  Channel. Its `TerminalLifecycleEvent` payload is `{ taskId, tab, agentCli,
  sessionId, exitCode, signal }`; `agentCli` and `signal` are nullable
  (`agentCli` is `null` for every shell tab). It is emitted once when the managed process exits
  and is not replayed when a terminal is reattached. An intentional stop
  (`stop_terminal_session`, task deletion, or app exit) does not publish it, so
  closing a tab never raises a terminal-exit notification.
- Native alert delivery checks notification permission and asks the user only
  until the first denial. Notifications are silent; `play_alert_sound` plays
  the bundled `resources/preview.m4a` on every alert, independently of
  notification permission.
- `TerminalManager` retains a bounded 1 MiB tail of PTY output per session.
  Reattachment replays that ordered output before forwarding new chunks, so a
  newly mounted xterm can restore recent terminal contents. An xterm instance
  also remains mounted while its modal is closed but the task board stays open.
- Terminal clipboard behaviour lives in the webview, not the pty. OSC 52 writes
  from the running CLI are honoured through `tauri-plugin-clipboard-manager`
  (read requests are dropped), a completed xterm selection is copied on mouseup,
  and Cmd+Shift+click opens http(s) links through the opener plugin. Plain clicks
  stay with the CLI, which tracks the mouse.
- `terminal_input` accepts UTF-8 text up to 64 KiB. `resize_terminal_session`
  accepts positive `cols` and `rows` up to 1,000; pixel dimensions default to
  zero when omitted. `stop_terminal_session` stops a managed PTY by session id,
  removes it from the inventory, and is used when an extra shell tab is closed;
  `forget_terminal_tab` clears a failed-start inventory entry for a tab that
  never produced a session, so reopening the modal does not recreate a closed
  failed tab. `agent` and `term` cannot be closed. Closing only the modal keeps
  its Channels and xterm buffers attached. Switching away from the task board
  detaches Channels while leaving PTYs alive. Argis stops and reaps all remaining
  PTYs on app exit and stops a task's PTYs before task deletion. Stop sends an
  interrupt through the PTY and to the managed child, waits at most 500 ms for
  graceful exit, then force-kills and reaps any child that remains. xterm uses a
  system monospace font with zero letter spacing; the surrounding UI continues
  to use Outfit.
- Browser mock mode does not launch local processes: reattach returns `null`,
  start/input/resize report that embedded processes require the desktop app,
  stop is a no-op, forget returns `false`, and detach returns `false`.

## Task-agent conversation resumption

The terminal flow reattaches directly to a live Argis-managed Agent PTY. With no
live Agent PTY, it offers `Resume <provider>` when a valid reference exists and
`Start new` in every usable task worktree. The CLI receives arguments as a
program plus separate argument values, never through a shell string. Reference
discovery must bind a provider-native ID to the Argis-launched process and task;
matching by title or working directory alone is insufficient. A missing,
stale, unsupported, or ambiguous reference is unavailable, not a reason to
guess. Before launch, Argis validates the task and canonical worktree binding,
the provider-native ID shape, and the referenced provider record. Resume starts a
new CLI process; it does not restore the previous PTY or xterm buffer.

Provider support matrix (verified 2026-10-15 against vendor documentation and
the installed Claude Code 2.1.300, Codex CLI 0.148.0, OpenCode 2.0.29, and Pi
1.2.0 CLI help on this development machine):

| CLI | New-session reference | Native resume invocation | Discovery / fallback |
| --- | --- | --- | --- |
| Claude Code | CLI-generated UUID in the session registry/transcript. | `claude --resume <session-id>` | Match the provider's owning PID, canonical worktree, and a session created after the managed PTY started; zero or multiple matches means unavailable. |
| Codex | CLI-generated thread UUID in the rollout/index. | `codex resume <session-id>` | Match the provider's assigned PID, canonical worktree, and a thread created after the managed PTY started; zero or multiple matches means unavailable. |
| OpenCode | CLI-generated `ses_…` ID in `opencode.db`. | `opencode --session <id>` | Match the provider's assigned PID, canonical worktree, and a session created after the managed PTY started; zero or multiple matches means unavailable. |
| Pi | CLI-generated session ID in the session JSONL. | `pi --session <id>` | Match the provider's owning PID, canonical worktree, and a session created after the managed PTY started; zero or multiple matches means unavailable. |

These flags are part of each CLI's provider-native behavior, not a shared
synthetic format. See [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference),
[Codex CLI reference](https://developers.openai.com/codex/cli/reference),
[OpenCode CLI](https://opencode.ai/docs/cli/), and
[Pi coding-agent usage](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md).

## Semantics

- **Session `id`**: `"{provider}:{nativeId}"`, stable across polls.
- **Elapsed time** is derived in the UI: `now − startedAt` while live,
  `updatedAt − startedAt` once `done`.
- **Progress** (`percent` 0–100), first match wins:
  1. `plan` — latest todo/plan list (`completed / total`).
  2. `status` — `done` ⇒ 100.
  3. `context` — `contextUsed / contextWindow` when both known.
  4. `none` — `percent: null`.
- **Status mapping**: `running` (working now), `idle` (waiting for the user's
  next prompt), `awaitingApproval` (blocked on a permission/question),
  `done` (subagent finished), `error` (last turn failed).

## Detection rules per provider

A session is *live* when its owning process is alive, or (fallback) its
transcript was written in the last 2 minutes.

### Claude Code (`~/.claude`)
- Live registry: `~/.claude/sessions/<pid>.json` →
  `{ pid, sessionId, cwd, startedAt, name, status: "busy"|"idle"|… }`.
  Keep entries whose `pid` is alive. `busy`→running, `idle`→idle.
- Transcript: `~/.claude/projects/*/<sessionId>.jsonl` (glob; the project dir is
  the cwd where the session *started*, not necessarily `cwd`).
- Tokens: sum `message.usage` of `type:"assistant"` lines, **deduplicated by
  `message.id`** (one API message is written as several lines). Context used =
  last usage `input + cache_read + cache_creation`. Window = 1 000 000 if model
  id contains `[1m]` or context used > 200 000, else 200 000.
- Progress plan: latest `TodoWrite` tool_use `input.todos[].status`, or the
  `TaskCreate`/`TaskUpdate` tool_use stream.
- Awaiting approval: last record is an assistant `tool_use` with no matching
  `tool_result` and the file is untouched for ≥ 8 s while status is busy.
- Subagents: `<projectDir>/<sessionId>/subagents/agent-*.jsonl` with sibling
  `agent-*.meta.json` (`agentType`, `description`). Only those modified after
  the session's `startedAt`. Done = last assistant `stop_reason:"end_turn"`.

### Codex (`~/.codex`)
- Index: newest `~/.codex/state_*.sqlite`, table `threads` (`id, rollout_path,
  cwd, title, name, model, tokens_used, created_at_ms, updated_at_ms,
  archived`). Subagents: `thread_spawn_edges(parent_thread_id,
  child_thread_id, status)`.
- Live: a `codex` process whose cwd equals the thread cwd and the thread was
  updated after the process started; fallback rollout mtime < 2 min.
- Rollout JSONL: `event_msg/token_count.info.total_token_usage` (totals),
  `last_token_usage.input_tokens` (context), `model_context_window`.
  `task_started` without later `task_complete` ⇒ running; `*_approval_request`
  pending ⇒ awaitingApproval. Plan from latest `update_plan` call
  (`plan[].status`). Current step from latest agent message.

### OpenCode (`~/.local/share/opencode/opencode.db`)
- Two layouts coexist; both are read and merged (V2 wins on duplicate ids):
  - **V2** (current releases): `session_v2` rows + `session_message`
    (`type` = `user` | `assistant` | `idle`, `data` JSON with inline
    `content[]` parts; tools use `name` + `state.status`).
  - **Legacy**: `session` + `message` (role inside `data`) + `part`.
- Root rows have `parent_id IS NULL`, `time_archived IS NULL`; tokens from
  `tokens_input/output/cache_read/cache_write`; `model` is JSON
  (`{id, providerID}`). Subagents = rows whose `parent_id` is the session.
- Live: an `opencode` process whose cwd equals `directory`; fallback
  `time_updated` < 2 min.
- Status: newest message `user` or unfinished/`tool-calls` assistant ⇒
  running; an `idle` row or finished assistant ⇒ idle; newest tool call is a
  `question` not yet completed ⇒ awaitingApproval.
- Context: newest assistant message with usage (`input + cache.read +
  cache.write`); window from `~/.cache/opencode/models.json`
  (`<provider>.models.<id>.limit.context`). Plan from the `todo` table.

### Pi (`~/.pi/agent/sessions`)
- Dir per cwd: `--<cwd with "/" → "-">--/*.jsonl`; first line
  `{type:"session", id, cwd, timestamp}`.
- Live: a `pi` process with that cwd (newest file after process start);
  fallback mtime < 2 min. Tokens: sum `message.usage` of assistant messages
  (`input, output, cacheRead, cacheWrite`). `stopReason`: `toolUse`→running,
  `stop`→idle, `error`→error. No subagents.
