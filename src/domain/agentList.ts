/** Pure grouping / sorting / filtering for the right-side "Agents" list. */
import type { AgentSession, AgentStatus, ProviderId } from "./types";
import { PROVIDER_ORDER, PROVIDERS, type ProviderMeta } from "./providers";
import { needsUser } from "./session";
import { STATUS_ORDER, statusRank } from "./status";

export type StatusFilter = AgentStatus | null;

export interface StatusCount {
  status: AgentStatus;
  count: number;
}

export interface AgentGroup {
  provider: ProviderId;
  meta: ProviderMeta;
  sessions: AgentSession[];
}

/**
 * Whether a session belongs under a status chip. "Needs you" (`awaitingApproval`)
 * also takes a session whose subagent is waiting: that is where the user must go.
 */
export function matchesStatus(session: AgentSession, status: AgentStatus): boolean {
  return status === "awaitingApproval" ? needsUser(session) : session.status === status;
}

/** Counts per status in display order, including zeros. */
export function statusCounts(sessions: readonly AgentSession[]): StatusCount[] {
  return STATUS_ORDER.map((status) => ({
    status,
    count: sessions.filter((s) => matchesStatus(s, status)).length,
  }));
}

/** Chips to show: non-zero counts, plus the active filter so it can be cleared. */
export function visibleChips(counts: readonly StatusCount[], filter: StatusFilter): StatusCount[] {
  return counts.filter((c) => c.count > 0 || c.status === filter);
}

/** Clicking the active chip clears the filter; any other chip selects it. */
export function toggleFilter(current: StatusFilter, status: AgentStatus): StatusFilter {
  return current === status ? null : status;
}

export function filterSessions(sessions: readonly AgentSession[], filter: StatusFilter): AgentSession[] {
  return filter ? sessions.filter((s) => matchesStatus(s, filter)) : [...sessions];
}

/** Status rank, except anything that needs the user ranks as "Needs you". */
function attentionRank(session: AgentSession): number {
  return needsUser(session) ? statusRank("awaitingApproval") : statusRank(session.status);
}

/** "Needs you" first, then error, running, idle, done; oldest first within a status. */
export function compareSessions(a: AgentSession, b: AgentSession): number {
  return (
    attentionRank(a) - attentionRank(b) ||
    a.startedAt - b.startedAt ||
    a.id.localeCompare(b.id)
  );
}

/** Provider groups in city order (Claude, Codex, OpenCode, Pi), empty ones skipped. */
export function groupSessions(sessions: readonly AgentSession[], filter: StatusFilter): AgentGroup[] {
  const visible = filterSessions(sessions, filter);
  return PROVIDER_ORDER.map((provider) => ({
    provider,
    meta: PROVIDERS[provider],
    sessions: visible.filter((s) => s.provider === provider).sort(compareSessions),
  })).filter((group) => group.sessions.length > 0);
}
