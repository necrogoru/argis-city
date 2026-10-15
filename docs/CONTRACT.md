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
| command | `create_task`             | `{ projectId, title, description }` → `Task`      |
| command | `update_task_details`     | `{ id, title, description }` → `Task`             |
| command | `update_task_status`      | `{ id, status }` → `Task`                         |
| command | `delete_task`             | `{ id, removeGitResources }` → `TaskDeletionOutcome` |
| command | `inspect_task_git_status` | `{ taskId }` → `TaskGitStatus`                    |
| command | `create_task_worktree`    | `{ taskId }` → `TaskWorktree`                     |
| command | `start_terminal_session`  | `{ taskId, tab, agentCli, size, onEvent }` → `TerminalAttachment` |
| command | `reattach_terminal_session` | `{ taskId, tab, onEvent }` → `TerminalAttachment \| null` |
| command | `terminal_input`          | `{ sessionId, data }` → `()`                     |
| command | `resize_terminal_session` | `{ sessionId, size }` → `()`                     |
| command | `detach_terminal_session` | `{ taskId, tab, attachmentId }` → `boolean`      |
| command | `list_terminal_inventory` | → `TerminalInventoryEntry[]`                     |
| event   | `agents://snapshot`       | `Snapshot`, emitted every poll (2 s)              |

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

- Each task has at most one process in each tab: `agent` or `term`. Both process
  working directories are resolved from the task's persisted worktree record;
  the frontend cannot provide a cwd or arbitrary executable. Argis checks that
  the worktree exists under the registered project and that its checked-out
  branch matches the task's recorded branch before starting or reattaching.
- Agent executable selection is an allowlist: `claude`, `codex`, `opencode`, or
  `pi`. `agentCli` is required for the Agent tab and `null` for the shell tab.
  The shell uses the user's configured shell (`SHELL`, or `COMSPEC` on Windows).
  Task names and descriptions are never passed as process arguments.
- `start_terminal_session` starts the selected PTY and returns a
  `TerminalAttachment`; if the same agent is already running in that task tab,
  it reattaches to it. A different agent cannot replace a running Agent tab.
  `reattach_terminal_session` returns `null` when that tab has no managed
  process. A completed process is reattached with `running: false` and its exit
  event is replayed.
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
- `TerminalManager` retains a bounded 1 MiB tail of PTY output per session.
  Reattachment replays that ordered output before forwarding new chunks, so a
  newly mounted xterm can restore recent terminal contents. An xterm instance
  also remains mounted while its modal is closed but the task board stays open.
- `terminal_input` accepts UTF-8 text up to 64 KiB. `resize_terminal_session`
  accepts positive `cols` and `rows` up to 1,000; pixel dimensions default to
  zero when omitted. Closing only the modal keeps its Channels and xterm buffers
  attached. Switching away from the task board detaches Channels while leaving
  PTYs alive. Argis stops and reaps all remaining PTYs on app exit and stops a
  task's PTYs before task deletion. xterm uses a system monospace font with zero
  letter spacing; the surrounding UI continues to use Outfit.
- Browser mock mode does not launch local processes: reattach returns `null`,
  start/input/resize report that embedded processes require the desktop app, and
  detach returns `false`.

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
