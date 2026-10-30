import { describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Project, Task, TaskAgentResume, TerminalInventoryEntry } from "../domain/types";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useTaskStore } from "./tasks";
import { useTerminalRailStore } from "./terminalRail";

const project: Project = { id: 1, path: "/projects/argis" };
const tasks: Task[] = [
  { id: 7, projectId: 1, title: "Add dashboard rail", description: "", status: "pending", branchName: null, worktreePath: "/w/7", images: [] },
  { id: 8, projectId: 1, title: "Verify terminal states", description: "", status: "pending", branchName: null, worktreePath: "/w/8", images: [] },
];

function setup(overrides: Partial<AgentSource> = {}) {
  const inventory = vi.fn(async (): Promise<TerminalInventoryEntry[]> => [{ taskId: 8, tab: "agent", state: "completed" }]);
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: async () => ({ generatedAt: 1, sessions: [], providers: [] }),
    refresh: async () => ({ generatedAt: 1, sessions: [], providers: [] }),
    subscribe: () => () => {},
    subscribeTerminalExit: () => () => {},
    playAlertSound: async () => {},
    openPath: async () => {},
    listProjects: vi.fn(async () => [project]),
    addProject: vi.fn(async (path) => ({ id: 2, path })),
    listTasks: vi.fn(async () => tasks),
    listTaskAgentResumes: vi.fn(async () => []),
    getTaskAgentResume: vi.fn(async () => null),
    saveTaskAgentResume: vi.fn(async (reference) => reference),
    createTask: vi.fn(async (projectId, title, description) => ({ ...tasks[0], id: 9, projectId, title, description })),
    updateTaskDetails: vi.fn(async (id, title, description) => ({ ...tasks[0], id, title, description })),
    updateTaskStatus: vi.fn(async (id, status) => ({ ...tasks[0], id, status })),
    deleteTask: vi.fn(async () => ({ taskDeleted: true, git: { requested: false, worktreeRemoved: false, branchRemoved: false, branchName: null, worktreePath: null, error: null } })),
    getTaskGitStatus: vi.fn(async (id) => ({
      isGitRepository: true,
      canCreateBranch: true,
      branchExists: false,
      branchName: `argis/${id}`,
      worktreePath: `/w/${id}`,
      reason: null,
    })),
    createTaskWorktree: vi.fn(async (id) => ({ branchName: `argis/${id}`, worktreePath: `/w/${id}` })),
    readTaskImage: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
    readImageFile: async () => { throw new Error("unused test operation"); },
    subscribeFileDrop: () => () => {},
    startTerminalSession: async () => { throw new Error("unused"); },
    resumeTaskAgent: async () => { throw new Error("unused"); },
    reattachTerminalSession: async () => null,
    sendTerminalInput: async () => {},
    resizeTerminalSession: async () => {},
    stopTerminalSession: async () => {},
    forgetTerminalTab: async () => false,
    detachTerminalSession: async () => false,
    listTerminalInventory: inventory,
    ...overrides,
  };

  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const taskStore = app.runWithContext(() => useTaskStore());
  const railStore = app.runWithContext(() => useTerminalRailStore());
  return { app, source, taskStore, railStore, inventory };
}

describe("useTerminalRailStore", () => {
  it("refreshes inventory from the typed source and combines it with cached tasks", async () => {
    const { taskStore, railStore, inventory } = setup();

    await taskStore.ensureSearchDataLoaded();
    await railStore.refreshInventory();

    expect(inventory).toHaveBeenCalledOnce();
    expect(railStore.entries).toEqual([
      expect.objectContaining({ taskId: 7, state: "idle" }),
      expect.objectContaining({ taskId: 8, state: "completed" }),
    ]);
  });

  it("shows a persisted conversation as resumable after tasks reload", async () => {
    const reference: TaskAgentResume = {
      taskId: 7,
      provider: "codex",
      nativeReference: "opaque-native-id",
      worktreePath: "/w/7",
      lastObservedAtMs: 100,
    };
    const { taskStore, railStore } = setup({ listTaskAgentResumes: async () => [reference] });

    await railStore.refreshAll();

    expect(taskStore.taskAgentResumes).toEqual([reference]);
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "resumable", resumeProvider: "codex" });
  });

  it("refreshes saved conversations while the Dashboard rail is polling", async () => {
    const reference: TaskAgentResume = {
      taskId: 7,
      provider: "claude",
      nativeReference: "12345678-1234-4abc-8def-123456789010",
      worktreePath: "/w/7",
      lastObservedAtMs: 100,
    };
    const listResumes = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([reference]);
    const { railStore, taskStore } = setup({ listTaskAgentResumes: listResumes });
    await taskStore.ensureSearchDataLoaded();

    await railStore.refreshAll();

    expect(taskStore.taskAgentResumes).toEqual([reference]);
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "resumable", resumeProvider: "claude" });
  });

  it("updates aggregate state when the modal publishes live tab statuses", async () => {
    const { taskStore, railStore } = setup();
    await taskStore.ensureSearchDataLoaded();

    railStore.publishTaskStatus(7, "agent", "starting");
    await nextTick();
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "pending" });

    railStore.publishTaskStatus(7, "agent", "running");
    await nextTick();
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "running" });

    railStore.publishTaskStatus(7, "agent", "exited");
    await nextTick();
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "completed" });

    railStore.publishTaskStatus(7, "agent", "error");
    await nextTick();
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "unavailable" });
  });

  it("clears transient live state for a task when requested", async () => {
    const { taskStore, railStore } = setup();
    await taskStore.ensureSearchDataLoaded();

    railStore.publishTaskStatus(7, "agent", "running");
    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "running" });

    railStore.clearTaskStatus(7);

    expect(railStore.entries[0]).toMatchObject({ taskId: 7, state: "idle" });
  });

  it("dedupes overlapping refreshes while one is already in flight", async () => {
    const deferred: { release: (() => void) | null } = { release: null };
    const listTasks = vi.fn(
      () => new Promise<Task[]>((resolve) => {
        deferred.release = () => resolve(tasks);
      }),
    );
    const inventory = vi.fn(async (): Promise<TerminalInventoryEntry[]> => [{ taskId: 8, tab: "agent", state: "completed" }]);
    const { railStore } = setup({ listTasks, listTerminalInventory: inventory });

    const first = railStore.refreshAll();
    void railStore.refreshAll();
    if (deferred.release == null) throw new Error("expected task refresh to be pending");
    deferred.release();

    await first;
    expect(listTasks).toHaveBeenCalledTimes(1);
    expect(inventory).toHaveBeenCalledTimes(1);
  });

  it("allows a later refresh after the previous refresh resolves", async () => {
    const inventory = vi.fn(async (): Promise<TerminalInventoryEntry[]> => [{ taskId: 8, tab: "agent", state: "completed" }]);
    const { railStore } = setup({ listTerminalInventory: inventory });

    await railStore.refreshAll();
    await railStore.refreshAll();

    expect(inventory).toHaveBeenCalledTimes(2);
  });
});
