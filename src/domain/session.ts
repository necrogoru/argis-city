import type {
  AgentSession,
  AgentStatus,
  ProviderId,
  Snapshot,
  TokenUsage,
} from "./types";
import { PROVIDERS, type ProviderMeta } from "./providers";

interface Timed {
  status: AgentStatus;
  startedAt: number;
  updatedAt: number;
}

/** `now − startedAt` while live, `updatedAt − startedAt` once done. */
export function elapsedMs(item: Timed, now: number): number {
  const end = item.status === "done" ? item.updatedAt : now;
  return Math.max(0, end - item.startedAt);
}

/** Share of the context window in use (0–1), or null when unknown. */
export function contextShare(tokens: TokenUsage): number | null {
  const { contextUsed, contextWindow } = tokens;
  if (contextUsed == null || contextWindow == null || contextWindow <= 0) return null;
  return Math.min(1, Math.max(0, contextUsed / contextWindow));
}

export interface SubagentCounts {
  total: number;
  running: number;
  awaiting: number;
}

export function subagentCounts(session: AgentSession): SubagentCounts {
  let running = 0;
  let awaiting = 0;
  for (const agent of session.subagents) {
    if (agent.status === "running") running += 1;
    if (agent.status === "awaitingApproval") awaiting += 1;
  }
  return { total: session.subagents.length, running, awaiting };
}

/** Blocked on the user: the session itself or one of its subagents awaits approval. */
export function needsUser(session: AgentSession): boolean {
  return session.status === "awaitingApproval" || session.subagents.some((a) => a.status === "awaitingApproval");
}

/** Sessions of one provider in stable house order (oldest first). */
export function sessionsOf(snapshot: Snapshot, provider: ProviderId): AgentSession[] {
  return snapshot.sessions
    .filter((s) => s.provider === provider)
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

export interface SelectedSession {
  session: AgentSession;
  /** 1-based house number within its district. */
  houseNumber: number;
  meta: ProviderMeta;
}

export function findSelected(
  snapshot: Snapshot | null,
  sessionId: string | null,
): SelectedSession | null {
  if (!snapshot || !sessionId) return null;
  const session = snapshot.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const index = sessionsOf(snapshot, session.provider).findIndex((s) => s.id === sessionId);
  return { session, houseNumber: index + 1, meta: PROVIDERS[session.provider] };
}
