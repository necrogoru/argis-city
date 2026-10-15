import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Project, Task } from "../domain/types";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useTaskStore } from "./tasks";

const project: Project = { id: 1, path: "/projects/argis" };
const task: Task = {
  id: 7,
  projectId: project.id,
  title: "Add task board",
  description: "Create the grouped view",
  status: "pending",
  branchName: null,
  worktreePath: null,
};

function setup(overrides: Partial<AgentSource> = {}) {
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: async () => ({ generatedAt: 1, sessions: [], providers: [] }),
    refresh: async () => ({ generatedAt: 1, sessions: [], providers: [] }),
    subscribe: () => () => {},
    openPath: async () => {},
    listProjects: vi.fn(async () => [project]),
    addProject: vi.fn(async (path) => ({ id: 2, path })),
    listTasks: vi.fn(async () => [task]),
    listTaskAgentResumes: vi.fn(async () => []),
    getTaskAgentResume: vi.fn(async () => null),
    saveTaskAgentResume: vi.fn(async (reference) => reference),
    createTask: vi.fn(async (projectId, title, description) => ({ ...task, id: 8, projectId, title, description })),
    updateTaskDetails: vi.fn(async (id, title, description) => ({ ...task, id, title, description })),
    updateTaskStatus: vi.fn(async (id, status) => ({ ...task, id, status })),
    deleteTask: vi.fn(async (_id, removeGitResources) => ({
      taskDeleted: true,
      git: {
        requested: removeGitResources,
        worktreeRemoved: false,
        branchRemoved: false,
        branchName: null,
        worktreePath: null,
        error: null,
      },
    })),
    getTaskGitStatus: vi.fn(async (id) => ({
      isGitRepository: true,
      canCreateBranch: true,
      branchExists: false,
      branchName: `argis/${id}-task`,
      worktreePath: `/projects/argis/.argis/worktrees/${id}-task`,
      reason: null,
    })),
    createTaskWorktree: vi.fn(async (id) => ({
      branchName: `argis/${id}-task`,
      worktreePath: `/projects/argis/.argis/worktrees/${id}-task`,
    })),
    startTerminalSession: async () => { throw new Error("unused test operation"); },
    reattachTerminalSession: async () => null,
    sendTerminalInput: async () => {},
    resizeTerminalSession: async () => {},
    detachTerminalSession: async () => false,
    listTerminalInventory: async () => [],
    ...overrides,
  };
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const store = app.runWithContext(() => useTaskStore());
  return { store, source };
}

describe("useTaskStore", () => {
  it("loads and reuses task search data without checking Git status", async () => {
    const { store, source } = setup();

    await store.ensureSearchDataLoaded();
    await store.ensureSearchDataLoaded();

    expect(source.listProjects).toHaveBeenCalledOnce();
    expect(source.listTasks).toHaveBeenCalledOnce();
    expect(source.getTaskGitStatus).not.toHaveBeenCalled();
    expect(store.projects).toEqual([project]);
    expect(store.tasks).toEqual([task]);
  });

  it("reloads cached search data after a task mutation", async () => {
    const createdTask = { ...task, id: 8, title: "New task" };
    const listTasks = vi.fn().mockResolvedValueOnce([task]).mockResolvedValueOnce([task, createdTask]);
    const { store, source } = setup({ listTasks });

    await store.ensureSearchDataLoaded();
    await store.createTask(project.id, createdTask.title, createdTask.description);
    await store.ensureSearchDataLoaded();

    expect(source.listTasks).toHaveBeenCalledTimes(2);
    expect(store.tasks).toEqual([task, createdTask]);
  });

  it("reloads cached search data after a project mutation", async () => {
    const addedProject = { id: 2, path: "/projects/other" };
    const listProjects = vi.fn().mockResolvedValueOnce([project]).mockResolvedValueOnce([project, addedProject]);
    const { store, source } = setup({ listProjects });

    await store.ensureSearchDataLoaded();
    await store.addProject(addedProject.path, true);
    await store.ensureSearchDataLoaded();

    expect(source.listProjects).toHaveBeenCalledTimes(2);
    expect(store.projects).toEqual([project, addedProject]);
  });

  it("loads projects and tasks through the injected source", async () => {
    const { store, source } = setup();

    await store.load();

    expect(source.listProjects).toHaveBeenCalledOnce();
    expect(source.listTasks).toHaveBeenCalledOnce();
    expect(store.projects).toEqual([project]);
    expect(store.tasks).toEqual([task]);
    expect(store.error).toBeNull();
  });

  it("adds projects and creates tasks in local state", async () => {
    const { store } = setup();

    const addedProject = await store.addProject("/projects/other", true);
    const createdTask = await store.createTask(project.id, "New task", "Description");

    expect(addedProject?.path).toBe("/projects/other");
    expect(createdTask).toMatchObject({ id: 8, projectId: project.id, status: "pending" });
    expect(store.projects.map((item) => item.path)).toContain("/projects/other");
    expect(store.tasks.map((item) => item.id)).toContain(8);
  });

  it("edits task details without changing the task identifier", async () => {
    const { store } = setup();
    await store.load();

    const edited = await store.updateTaskDetails(task.id, "Edited title", "Edited description");

    expect(edited?.id).toBe(task.id);
    expect(store.tasks[0]).toMatchObject({ id: task.id, title: "Edited title", description: "Edited description" });
  });

  it("updates status and removes a task only after deletion succeeds", async () => {
    const { store, source } = setup();
    await store.load();

    const updated = await store.updateTaskStatus(task.id, "inProgress");
    expect(updated?.status).toBe("inProgress");
    expect(store.tasks[0].status).toBe("inProgress");

    expect(await store.deleteTask(task.id, true)).toMatchObject({ taskDeleted: true, git: { requested: true } });
    expect(source.deleteTask).toHaveBeenCalledWith(task.id, true);
    expect(store.tasks).toEqual([]);
  });

  it("keeps a task and exposes an error when deletion fails", async () => {
    const { store } = setup({
      deleteTask: vi.fn(async () => Promise.reject(new Error("Task deletion failed"))),
    });
    await store.load();

    expect(await store.deleteTask(task.id, true)).toBeNull();
    expect(store.tasks).toEqual([task]);
    expect(store.error).toBe("Task deletion failed");
  });

  it("loads task Git status and stores newly created worktree details", async () => {
    const available = {
      isGitRepository: true,
      canCreateBranch: true,
      branchExists: false,
      branchName: "argis/7-add-task-board",
      worktreePath: "/projects/argis/.argis/worktrees/7-add-task-board",
      reason: null,
    };
    const created = { branchName: available.branchName, worktreePath: available.worktreePath };
    const linked = { ...available, canCreateBranch: false, branchExists: true, reason: "Task already has a branch or worktree" };
    const { store, source } = setup({
      getTaskGitStatus: vi.fn().mockResolvedValueOnce(available).mockResolvedValueOnce(linked),
      createTaskWorktree: vi.fn(async () => created),
    });
    await store.load();

    expect(store.gitStatuses[task.id]).toEqual(available);
    await expect(store.createTaskWorktree(task.id)).resolves.toEqual(created);
    expect(source.createTaskWorktree).toHaveBeenCalledWith(task.id);
    expect(store.tasks[0]).toMatchObject(created);
    expect(store.gitStatuses[task.id]).toEqual(linked);
  });
});
