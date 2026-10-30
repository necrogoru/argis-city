import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Task, TerminalLifecycleEvent } from "../domain/types";
import { session, snapshot } from "../domain/testFixtures";
import type { AlertDelivery, AlertDeliveryRequest } from "../services/alertDelivery";
import { agentSourceKey } from "../composables/useAgentSource";
import { MockAgentSource } from "../services/mock/mockAgentSource";
import { useSessionAlertCoordinator } from "./sessionAlerts";

const task: Task = {
  id: 7,
  projectId: 1,
  title: "Build alert routing",
  description: "",
  status: "inProgress",
  branchName: "argis/7-build-alert-routing",
  worktreePath: "/worktrees/7/",
  images: [],
};

function setup() {
  const source = new MockAgentSource("empty");
  let terminalListener: ((event: TerminalLifecycleEvent) => void) | null = null;
  source.subscribeTerminalExit = (callback) => {
    terminalListener = callback;
    return () => {
      terminalListener = null;
    };
  };
  source.listTasks = async () => [task];

  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const coordinator = app.runWithContext(() => useSessionAlertCoordinator());
  const delivery: AlertDelivery = { deliver: vi.fn(async (_alert: AlertDeliveryRequest) => {}) };
  const stop = coordinator.start(delivery);

  return {
    coordinator,
    delivery,
    exit: (event: TerminalLifecycleEvent) => terminalListener?.(event),
    stop,
  };
}

function exitEvent(overrides: Partial<TerminalLifecycleEvent> = {}): TerminalLifecycleEvent {
  return {
    taskId: task.id,
    tab: "agent",
    agentCli: "claude",
    sessionId: 101,
    exitCode: 0,
    signal: null,
    ...overrides,
  };
}

describe("useSessionAlertCoordinator", () => {
  it.each(["terminal-first", "session-first"] as const)(
    "deduplicates a matching managed Agent and observed completion when %s",
    async (first) => {
      const { coordinator, delivery, exit, stop } = setup();
      coordinator.acceptSnapshot(snapshot([session({ cwd: "/worktrees/./7/", status: "running" })]));

      if (first === "terminal-first") {
        exit(exitEvent());
        await Promise.resolve();
        await Promise.resolve();
      }

      coordinator.acceptSnapshot(snapshot([session({ cwd: "/worktrees/7", status: "idle" })]));

      if (first === "session-first") {
        exit(exitEvent());
        await Promise.resolve();
        await Promise.resolve();
      }

      expect(delivery.deliver).toHaveBeenCalledOnce();
      expect(delivery.deliver).toHaveBeenCalledWith(
        expect.objectContaining({ kind: first === "terminal-first" ? "terminalExit" : "completion" }),
      );
      if (first === "terminal-first") {
        expect(delivery.deliver).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Terminal exited",
            body: expect.stringContaining(`${task.title} · Claude Code Agent exited`),
          }),
        );
      }
      stop();
    },
  );

  it("keeps a different provider's completion independent in the same worktree", async () => {
    const { coordinator, delivery, exit, stop } = setup();
    coordinator.acceptSnapshot(snapshot([session({ provider: "codex", cwd: task.worktreePath!, status: "running" })]));

    exit(exitEvent({ sessionId: 102, agentCli: "claude" }));
    await Promise.resolve();
    await Promise.resolve();
    coordinator.acceptSnapshot(snapshot([session({ provider: "codex", cwd: task.worktreePath!, status: "idle" })]));

    expect(delivery.deliver).toHaveBeenCalledTimes(2);
    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ kind: "terminalExit" }));
    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ kind: "completion" }));
    stop();
  });

  it("does not deduplicate independent observed sessions in the same worktree", () => {
    const { coordinator, delivery, stop } = setup();
    coordinator.acceptSnapshot(
      snapshot([
        session({ id: "claude:first", cwd: task.worktreePath!, status: "running" }),
        session({ id: "claude:second", cwd: task.worktreePath!, status: "running" }),
      ]),
    );
    coordinator.acceptSnapshot(
      snapshot([
        session({ id: "claude:first", cwd: task.worktreePath!, status: "idle" }),
        session({ id: "claude:second", cwd: task.worktreePath!, status: "done" }),
      ]),
    );

    expect(delivery.deliver).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not deduplicate separate managed Agent exits for one task", async () => {
    const { delivery, exit, stop } = setup();

    exit(exitEvent({ sessionId: 201 }));
    exit(exitEvent({ sessionId: 202 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(delivery.deliver).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not deduplicate an independent shell exit against a harness completion", async () => {
    const { coordinator, delivery, exit, stop } = setup();
    coordinator.acceptSnapshot(snapshot([session({ cwd: task.worktreePath!, status: "running" })]));
    coordinator.acceptSnapshot(snapshot([session({ cwd: task.worktreePath!, status: "idle" })]));

    exit(exitEvent({ tab: "term", agentCli: null, sessionId: 103 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(delivery.deliver).toHaveBeenCalledTimes(2);
    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ kind: "completion" }));
    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ kind: "terminalExit", body: expect.stringContaining("Shell") }));
    stop();
  });

  it("names an extra shell slot in its exit notification", async () => {
    const { delivery, exit, stop } = setup();

    exit(exitEvent({ tab: "term-2", agentCli: null, sessionId: 104 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(delivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "terminalExit", body: expect.stringContaining("Shell 2") }),
    );
    stop();
  });

  it("formats approval alerts with the harness and session labels", () => {
    const { coordinator, delivery, stop } = setup();
    coordinator.acceptSnapshot(snapshot([session({ title: "Deploy service", status: "running" })]));
    coordinator.acceptSnapshot(snapshot([session({ title: "Deploy service", status: "awaitingApproval" })]));

    expect(delivery.deliver).toHaveBeenCalledWith({
      kind: "approval",
      title: "Approval needed",
      body: "Claude Code · Deploy service",
    });
    stop();
  });
});
