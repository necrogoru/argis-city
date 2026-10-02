/** Pure grouping / sorting / filtering for the right-side "Agents" list. */
import type { AgentSession, AgentStatus, ProviderId } from "./types";
import { PROVIDER_ORDER, PROVIDERS, type ProviderMeta } from "./providers";
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

/** Counts per status in display order, including zeros. */
export function statusCounts(sessions: readonly AgentSession[]): StatusCount[] {
  return STATUS_ORDER.map((status) => ({
    status,
    count: sessions.filter((s) => s.status === status).length,
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
  return filter ? sessions.filter((s) => s.status === filter) : [...sessions];
}

/** "Needs you" first, then running, idle, done, error; oldest first within a status. */
export function compareSessions(a: AgentSession, b: AgentSession): number {
  return (
    statusRank(a.status) - statusRank(b.status) ||
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
