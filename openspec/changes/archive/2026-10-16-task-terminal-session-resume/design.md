# Design

## Context

See `proposal.md` for motivation and `specs/task-terminal-resumption/spec.md` for user-visible behavior. `TaskStore` already persists Argis-owned task data in SQLite, while `TerminalManager` owns live PTYs and an in-memory bounded output buffer. It reattaches to live task/tab processes, and Argis shutdown stops and reaps them. The terminal modal and Dashboard launcher already converge on app-level task navigation, but the Dashboard inventory and resume metadata are currently runtime-only.

The existing terminal contract deliberately does not keep child processes alive after Argis exits. This change preserves that boundary: native conversation recovery is distinct from PTY or terminal-screen recovery.

## Goals / Non-Goals

**Goals:**
- Keep an Argis-managed task's latest identifiable agent conversation discoverable after restart.
- Reuse one task-scoped resume flow from the task board, Dashboard launcher, and matching selected-house action.
- Preserve live-process reattachment while Argis is running and current task-deletion cleanup guarantees.
- Limit saved metadata to the provider reference and the task/worktree association needed to resume safely.

**Non-Goals:**
- Keeping CLI processes alive after Argis exits or restoring their old PTY, xterm buffer, or shell session.
- Importing or discovering arbitrary sessions launched outside Argis, or retroactively assigning old CLI conversations to tasks.
- Building a multi-session history browser; Argis retains one latest resumable reference per task.
- Guaranteeing recovery of an in-flight model response that the provider CLI did not durably save before shutdown.

## Decisions

### Store one latest resumable reference in Argis-owned task data

Add a versioned SQLite table in the existing app-owned task database, keyed by task, containing the provider, opaque provider-native resume reference, canonical worktree path, and last-observed time. A new identifiable conversation replaces that task's previous reference. The reference is local metadata only: do not copy transcripts or write to provider-owned directories. Existing tasks and CLI histories receive no automatic backfill; a reference becomes available after Argis can identify a conversation it launched.

**Alternative considered:** persist only the CLI name and relaunch without a reference. This can start a different conversation or depend on each CLI's interactive defaults, so it is not a reliable resume contract.

### Resolve and launch through provider-specific adapters

Define an adapter per supported CLI that can associate an Argis-launched process with a stable native conversation reference and construct its native resume argument vector. Verify the actual mechanism for Claude, Codex, OpenCode, and Pi before enabling resume for each. Never guess from task title or working directory alone: if the adapter cannot uniquely identify or validate a reference, mark resume unavailable and preserve Start new. Pass arguments directly to the process builder, not through a shell string.

**Alternative considered:** one generic resume flag or parsing terminal text. CLI resume syntax and output are provider-specific and can change; a generic guess can attach the wrong conversation. Unsupported or ambiguous providers therefore degrade to a clear unavailable state.

### Prefer a live PTY; prompt only when none exists

When a task already has a live Argis-managed Agent PTY, preserve the existing direct reattachment behavior. When it does not, load the saved task reference and show `Resume <provider>` and `Start new`; the latter retains the existing CLI selector. All entry points use the same terminal-navigation state. The Dashboard launcher combines the runtime PTY inventory with durable resume availability, so a resumable task remains visible after app restart without discovering external processes.

**Alternative considered:** always show the chooser, including for live PTYs. That adds friction and risks starting a duplicate process when the existing process is already available.

### Validate the task/worktree binding before resume

Before building a resume command, resolve the task's recorded worktree using the existing validation path and compare its canonical form with the saved association. If the task is deleted, the worktree is missing, or the association differs, do not launch the saved reference in another directory; report resume unavailable and leave Start new available only when the task worktree itself is usable.

### Keep references inside task deletion and shutdown boundaries

Task deletion continues to stop and reap PTYs first; delete the associated resume reference only as part of successful task-record deletion. On app exit, keep the PTY shutdown path, but give an active Agent CLI a bounded graceful-interrupt opportunity to flush provider state before forced termination. Never make shutdown wait indefinitely. The provider's native conversation is the source of restored context; the old terminal output buffer remains memory-only.

**Alternative considered:** persist terminal output and replay it as if it were a live session. That cannot recreate process state and risks implying that a completed screen transcript is an interactive conversation.

## Risks / Trade-offs

- **Provider metadata or resume syntax changes** → Keep adapters isolated, test each supported CLI's identification and resume behavior, and mark unsupported versions unavailable instead of guessing.
- **Concurrent sessions make a provider reference ambiguous** → Associate only when an adapter can uniquely link the launched process to the native conversation; otherwise retain no resumable reference.
- **A CLI fails to flush during forced shutdown** → Attempt a bounded graceful interrupt; describe resume as best-effort and retain the Start new path.
- **Saved reference no longer matches the worktree or native provider state** → Validate both before launch and surface an unavailable state without falling back to another directory.
- **Resume metadata can reveal local work history** → Store only the opaque reference and task/worktree metadata in the local Argis database; do not sync it or store conversation contents.

## Migration Plan

1. Add an additive, versioned TaskStore migration for the latest per-task provider reference; existing task rows remain valid with no reference.
2. Release provider adapters and transport/UI support. Only sessions identified after this feature is installed become resumable; unsupported or unidentifiable sessions remain start-new only.
3. On rollback, Argis can ignore the additive table and use its existing PTY lifecycle. Removing the table is optional and would discard resume pointers, not task records or provider-owned conversations.
