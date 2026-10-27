import { describe, expect, it, vi } from "vitest";
import type { AgentStatus, TaskAgentResume } from "../../domain/types";
import { createSeedSnapshot, MockAgentSource } from "./mockAgentSource";
import { FLIP_EVERY, flipStatus, tickSnapshot } from "./mockTick";

const count = (provider: string, snap = createSeedSnapshot(0)) =>
  snap.sessions.filter((s) => s.provider === provider).length;

describe("mock seed", () => {
  it("has the 5 / 4 / 3 / 2 provider split", () => {
    expect([count("claude"), count("codex"), count("opencode"), count("pi")]).toEqual([5, 4, 3, 2]);
  });

  it("covers every subagent status", () => {
    const statuses = new Set<AgentStatus>(
      createSeedSnapshot(0).sessions.flatMap((s) => s.subagents.map((a) => a.status)),
    );
    expect([...statuses].sort()).toEqual(["awaitingApproval", "done", "error", "idle", "running"]);
  });

  it("gives sessions every status, with 'needs you' in several districts", () => {
    const sessions = createSeedSnapshot(0).sessions;
    expect(new Set(sessions.map((s) => s.status)).size).toBe(5);
    const awaiting = sessions.filter((s) => s.status === "awaitingApproval");
    expect(new Set(awaiting.map((s) => s.provider)).size).toBeGreaterThanOrEqual(3);
  });

  it("follows the contract id and progress rules", () => {
    for (const session of createSeedSnapshot(0).sessions) {
      expect(session.id.startsWith(`${session.provider}:`)).toBe(true);
      if (session.progress.source === "none") expect(session.progress.percent).toBeNull();
    }
  });

  it("supports an empty scenario with an uninstalled provider", () => {
    const empty = createSeedSnapshot(0, "empty");
    expect(empty.sessions).toHaveLength(0);
    expect(empty.providers.find((p) => p.provider === "pi")?.available).toBe(false);
  });
});

describe("mock project and task operations", () => {
  it("persists task-agent resume references and removes them when the task is deleted", async () => {
    const source = new MockAgentSource("empty");
    const project = await source.addProject("/projects/argis", false);
    const task = await source.createTask(project.id, "Resume", "");
    const reference: TaskAgentResume = {
      taskId: task.id,
      provider: "codex",
      nativeReference: "opaque-session-id",
      worktreePath: "/projects/argis/.argis/worktrees/1-resume",
      lastObservedAtMs: 1_780_000_000_123,
    };

    await expect(source.getTaskAgentResume(task.id)).resolves.toBeNull();
    await expect(source.saveTaskAgentResume(reference)).resolves.toEqual(reference);
    await expect(source.getTaskAgentResume(task.id)).resolves.toEqual(reference);
    await expect(source.listTaskAgentResumes()).resolves.toEqual([reference]);
    await source.deleteTask(task.id, false);
    await expect(source.listTaskAgentResumes()).resolves.toEqual([]);
  });

  it("creates projects and tasks, updates task details/status, and deletes tasks", async () => {
    const source = new MockAgentSource("empty");
    const project = await source.addProject("/projects/argis", false);
    const task = await source.createTask(project.id, "Add task board", "Create the grouped view");

    expect(await source.listProjects()).toEqual([project]);
    expect(await source.listTasks(project.id)).toEqual([task]);
    expect(task.status).toBe("pending");

    const edited = await source.updateTaskDetails(task.id, "Edited title", "Edited description");
    const updated = await source.updateTaskStatus(task.id, "inProgress");
    expect(edited.id).toBe(task.id);
    expect(updated.status).toBe("inProgress");

    const deleted = await source.deleteTask(task.id, false);
    expect(deleted).toMatchObject({
      taskDeleted: true,
      git: { requested: false, branchName: null, worktreePath: null, error: null },
    });
    expect(await source.listTasks()).toEqual([]);
  });

  it("simulates Git capability and associates a created worktree with its task", async () => {
    const source = new MockAgentSource("empty");
    const project = await source.addProject("/projects/argis", false);
    const task = await source.createTask(project.id, "Add task board", "Create the grouped view");

    const before = await source.getTaskGitStatus(task.id);
    expect(before.canCreateBranch).toBe(true);
    expect(before.branchName).toBe("argis/1-add-task-board");

    const worktree = await source.createTaskWorktree(task.id);

    expect(worktree.worktreePath).toBe("/projects/argis/.argis/worktrees/1-add-task-board");
    expect((await source.listTasks(project.id))[0]).toMatchObject({
      branchName: worktree.branchName,
      worktreePath: worktree.worktreePath,
    });
    expect((await source.getTaskGitStatus(task.id)).canCreateBranch).toBe(false);
  });

  it("does not pretend browser mock mode can start or reattach local PTYs", async () => {
    const source = new MockAgentSource("empty");

    await expect(source.listTerminalInventory()).resolves.toEqual([]);
    await expect(source.playAlertSound()).resolves.toBeUndefined();
    await expect(source.reattachTerminalSession(1, "agent", null, () => {})).resolves.toBeNull();
    await expect(source.startTerminalSession(1, "agent", "claude", { cols: 80, rows: 24 }, () => {}))
      .rejects.toThrow("only available in the Argis desktop app");
    await expect(source.sendTerminalInput(1, "pwd\n")).rejects.toThrow("only available in the Argis desktop app");
    await expect(source.resizeTerminalSession(1, { cols: 80, rows: 24 })).rejects.toThrow(
      "only available in the Argis desktop app",
    );
    await expect(source.detachTerminalSession(1, "agent", 1)).resolves.toBe(false);
  });

  it("provides a no-op app-wide terminal-exit subscription in browser mock mode", () => {
    const source = new MockAgentSource("empty");
    const callback = vi.fn();

    expect(source.subscribeTerminalExit(callback)).toEqual(expect.any(Function));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("tickSnapshot", () => {
  it("keeps session ids stable, bumps generatedAt and only grows tokens", () => {
    const seed = createSeedSnapshot(0);
    let rolls = 0;
    const next = tickSnapshot(seed, 2_000, () => (rolls++ % 10) / 10);
    expect(next.generatedAt).toBe(2_000);
    expect(next.sessions.map((s) => s.id)).toEqual(seed.sessions.map((s) => s.id));
    next.sessions.forEach((s, i) => expect(s.tokens.total).toBeGreaterThanOrEqual(seed.sessions[i].tokens.total));
  });

  it("preserves provider availability across ticks", () => {
    const next = tickSnapshot(createSeedSnapshot(0, "empty"), 2_000, () => 0.5);
    expect(next.providers.find((p) => p.provider === "pi")?.available).toBe(false);
  });
});

describe("status flips", () => {
  it("cycles running into needs-you / done / error and back", () => {
    expect([0, 1, 2, 3].map((v) => flipStatus("running", v))).toEqual([
      "awaitingApproval",
      "done",
      "awaitingApproval",
      "error",
    ]);
    expect(flipStatus("awaitingApproval", 0)).toBe("running");
    expect(flipStatus("done", 0)).toBe("idle");
    expect(flipStatus("idle", 0)).toBe("running");
  });

  it("flips exactly one session every few ticks", () => {
    const seed = createSeedSnapshot(0);
    const still = () => 0.99; // no random transitions
    const changed = (tick: number) =>
      tickSnapshot(seed, 2_000, still, tick).sessions.filter((s, i) => s.status !== seed.sessions[i].status);
    expect(changed(FLIP_EVERY - 1)).toHaveLength(0);
    expect(changed(FLIP_EVERY)).toHaveLength(1);
  });
});
