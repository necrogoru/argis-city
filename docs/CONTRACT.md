# Argis — backend ⇄ UI contract

Argis renders every coding-agent session running on this machine as a 3D city:
one tower per tool (provider), one house per live session, subagents as cards.

## Transport

| Kind    | Name                 | Payload / return                     |
| ------- | -------------------- | ------------------------------------ |
| command | `get_snapshot`       | → `Snapshot` (latest cached)         |
| command | `refresh_snapshot`   | → `Snapshot` (forces a collect now)  |
| command | `open_path`          | `{ path: string }` → `()` (Finder)   |
| event   | `agents://snapshot`  | `Snapshot`, emitted every poll (2 s) |

Types live in `src/domain/types.ts` (TS) and `src-tauri/src/domain/` (Rust,
serde `rename_all = "camelCase"`, enums `camelCase`). All timestamps are Unix
epoch **milliseconds**. Optional fields serialize as `null`, never omitted.

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
