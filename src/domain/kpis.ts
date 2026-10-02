import type { Snapshot } from "./types";

export interface CityKpis {
  /** Live sessions across every provider. */
  activeAgents: number;
  /** Subagents attached to live sessions. */
  subagents: number;
  runningSubagents: number;
  /** Sessions + subagents, all-time tokens of what is live now. */
  totalTokens: number;
  /** Sessions and subagents blocked on the user. */
  awaiting: number;
}

export const EMPTY_KPIS: CityKpis = {
  activeAgents: 0,
  subagents: 0,
  runningSubagents: 0,
  totalTokens: 0,
  awaiting: 0,
};

export function computeKpis(snapshot: Snapshot | null): CityKpis {
  if (!snapshot) return EMPTY_KPIS;
  const kpis = { ...EMPTY_KPIS, activeAgents: snapshot.sessions.length };
  for (const session of snapshot.sessions) {
    kpis.totalTokens += session.tokens.total;
    if (session.status === "awaitingApproval") kpis.awaiting += 1;
    for (const agent of session.subagents) {
      kpis.subagents += 1;
      kpis.totalTokens += agent.tokens.total;
      if (agent.status === "running") kpis.runningSubagents += 1;
      if (agent.status === "awaitingApproval") kpis.awaiting += 1;
    }
  }
  return kpis;
}
