import { defineStore } from "pinia";
import { advanceSessionAlerts, createSessionAlertState, type SessionAlert } from "../domain/sessionAlerts";
import { normalizeAbsolutePath } from "../domain/paths";
import { PROVIDERS } from "../domain/providers";
import { truncateLabel } from "../domain/format";
import type { ProviderId, Snapshot, Task, TerminalLifecycleEvent, TerminalTab } from "../domain/types";
import { useAgentSource } from "../composables/useAgentSource";
import type { AlertDelivery, AlertDeliveryRequest } from "../services/alertDelivery";

const COMPLETION_DEDUPE_WINDOW_MS = 10_000;

interface PendingCrossSourceCompletions {
  session: number[];
  terminal: number[];
}

export interface CoordinatedAlert extends AlertDeliveryRequest {
  source: "session" | "terminal";
  eventId: string;
  sessionId?: string;
  provider?: ProviderId;
  taskId?: number;
  tab?: TerminalTab;
}

function completionKey(provider: ProviderId, path: string): string | null {
  const normalizedPath = normalizeAbsolutePath(path);
  return normalizedPath ? `${provider}\u0000${normalizedPath}` : null;
}

function conciseBody(body: string): string {
  return truncateLabel(body.replace(/\s+/g, " ").trim(), 120);
}

function sessionNotification(alert: SessionAlert): CoordinatedAlert {
  const provider = PROVIDERS[alert.provider].label;
  const sessionName = alert.subagent ? `${alert.sessionTitle} · ${alert.title}` : alert.title;
  return {
    source: "session",
    eventId: alert.entityId,
    sessionId: alert.sessionId,
    provider: alert.provider,
    kind: alert.kind,
    title:
      alert.kind === "approval" ? "Approval needed" : alert.kind === "failure" ? "Run failed" : "Run complete",
    body: conciseBody(`${provider} · ${sessionName}`),
  };
}

function terminalNotification(event: TerminalLifecycleEvent, task: Task | null): CoordinatedAlert {
  const taskName = task?.title ?? `Task ${event.taskId}`;
  const tabName = event.tab === "agent" ? "Agent" : "Shell";
  const agentName = event.agentCli ? `${PROVIDERS[event.agentCli].label} ` : "";
  const exitDetail = event.signal ? `signal ${event.signal}` : `code ${event.exitCode}`;
  return {
    source: "terminal",
    eventId: `terminal:${event.sessionId}`,
    taskId: event.taskId,
    tab: event.tab,
    kind: "terminalExit",
    title: "Terminal exited",
    body: conciseBody(`${taskName} · ${agentName}${tabName} exited (${exitDetail})`),
  };
}

export const useSessionAlertCoordinator = defineStore("sessionAlertCoordinator", () => {
  const source = useAgentSource();
  let state = createSessionAlertState();
  let delivery: AlertDelivery | null = null;
  let stopTerminalExitSubscription: (() => void) | null = null;
  const listeners = new Set<(alert: CoordinatedAlert) => void>();
  const recentCompletions = new Map<string, PendingCrossSourceCompletions>();
  const handledTerminalSessionIds = new Set<number>();

  function publish(alert: CoordinatedAlert): void {
    listeners.forEach((listener) => listener(alert));
    if (!delivery) return;

    const request: AlertDeliveryRequest = { kind: alert.kind, title: alert.title, body: alert.body };
    void delivery.deliver(request).catch((error: unknown) => {
      console.error("[argis] alert coordinator delivery failed", error);
    });
  }

  function matchesOtherSourceCompletion(key: string, sourceType: "session" | "terminal", now: number): boolean {
    for (const [candidate, completions] of recentCompletions) {
      completions.session = completions.session.filter((timestamp) => now - timestamp <= COMPLETION_DEDUPE_WINDOW_MS);
      completions.terminal = completions.terminal.filter((timestamp) => now - timestamp <= COMPLETION_DEDUPE_WINDOW_MS);
      if (completions.session.length === 0 && completions.terminal.length === 0) recentCompletions.delete(candidate);
    }
    const completions = recentCompletions.get(key) ?? { session: [], terminal: [] };
    const oppositeSource = sourceType === "session" ? completions.terminal : completions.session;
    if (oppositeSource.length > 0) {
      oppositeSource.shift();
      if (completions.session.length === 0 && completions.terminal.length === 0) recentCompletions.delete(key);
      else recentCompletions.set(key, completions);
      return true;
    }
    completions[sourceType].push(now);
    recentCompletions.set(key, completions);
    return false;
  }

  function acceptSessionAlert(alert: SessionAlert): void {
    if (alert.kind === "completion" && !alert.subagent) {
      const key = completionKey(alert.provider, alert.cwd);
      const now = Date.now();
      if (key && matchesOtherSourceCompletion(key, "session", now)) return;
    }
    publish(sessionNotification(alert));
  }

  async function acceptTerminalExit(event: TerminalLifecycleEvent): Promise<void> {
    if (handledTerminalSessionIds.has(event.sessionId)) return;
    handledTerminalSessionIds.add(event.sessionId);

    let task: Task | null = null;
    try {
      task = (await source.listTasks()).find((candidate) => candidate.id === event.taskId) ?? null;
    } catch (error) {
      console.error("[argis] failed to resolve task for terminal exit alert", error);
    }

    if (event.tab === "agent" && event.agentCli && task?.worktreePath) {
      const key = completionKey(event.agentCli, task.worktreePath);
      const now = Date.now();
      if (key && matchesOtherSourceCompletion(key, "terminal", now)) return;
    }

    publish(terminalNotification(event, task));
  }

  function acceptSnapshot(snapshot: Snapshot): void {
    const result = advanceSessionAlerts(state, snapshot);
    state = result.state;
    result.alerts.forEach(acceptSessionAlert);
  }

  function start(nextDelivery: AlertDelivery): () => void {
    if (stopTerminalExitSubscription) return stopTerminalExitSubscription;
    delivery = nextDelivery;
    let stopped = false;
    const unsubscribe = source.subscribeTerminalExit((event) => {
      if (!stopped) void acceptTerminalExit(event);
    });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      if (stopTerminalExitSubscription === stop) stopTerminalExitSubscription = null;
      if (delivery === nextDelivery) delivery = null;
    };
    stopTerminalExitSubscription = stop;
    return stop;
  }

  function subscribe(listener: (alert: CoordinatedAlert) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { acceptSnapshot, start, subscribe };
});
