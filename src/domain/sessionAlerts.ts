import type { AgentStatus, ProviderId, Snapshot } from "./types";

export type SessionAlertKind = "approval" | "completion";

export interface SessionAlert {
  kind: SessionAlertKind;
  entityId: string;
  sessionId: string;
  provider: ProviderId;
  sessionTitle: string;
  title: string;
  cwd: string;
  subagent: boolean;
}

interface ObservedStatus {
  provider: ProviderId;
  status: AgentStatus;
}

export interface SessionAlertState {
  initialized: boolean;
  statuses: Record<string, ObservedStatus>;
}

export function createSessionAlertState(): SessionAlertState {
  return { initialized: false, statuses: {} };
}

/** Returns status-transition alerts and the state to use for the next snapshot. */
export function advanceSessionAlerts(
  state: SessionAlertState,
  snapshot: Snapshot,
): { state: SessionAlertState; alerts: SessionAlert[] } {
  const unavailableProviders = new Set(
    snapshot.providers
      .filter((summary) => !summary.available || summary.error !== null)
      .map((summary) => summary.provider),
  );
  const nextStatuses: Record<string, ObservedStatus> = {};
  const alerts: SessionAlert[] = [];

  for (const [entityId, previous] of Object.entries(state.statuses)) {
    if (unavailableProviders.has(previous.provider)) nextStatuses[entityId] = previous;
  }

  for (const session of snapshot.sessions) {
    if (unavailableProviders.has(session.provider)) continue;

    const entities = [
      {
        entityId: `session:${session.id}`,
        sessionId: session.id,
        provider: session.provider,
        sessionTitle: session.title,
        title: session.title,
        cwd: session.cwd,
        status: session.status,
        subagent: false,
      },
      ...session.subagents.map((subagent) => ({
        entityId: `subagent:${session.id}:${subagent.id}`,
        sessionId: session.id,
        provider: session.provider,
        sessionTitle: session.title,
        title: subagent.title,
        cwd: session.cwd,
        status: subagent.status,
        subagent: true,
      })),
    ];

    for (const entity of entities) {
      const previous = state.statuses[entity.entityId];
      if (state.initialized && entity.status === "awaitingApproval" && previous?.status !== "awaitingApproval") {
        alerts.push({ kind: "approval", ...entity });
      } else if (
        state.initialized &&
        previous?.status === "running" &&
        (entity.status === "idle" || entity.status === "done")
      ) {
        alerts.push({ kind: "completion", ...entity });
      }
      nextStatuses[entity.entityId] = { provider: entity.provider, status: entity.status };
    }
  }

  return {
    state: { initialized: true, statuses: nextStatuses },
    alerts,
  };
}
