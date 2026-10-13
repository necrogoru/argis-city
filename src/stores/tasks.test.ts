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
    createTask: vi.fn(async (projectId, title, description) => ({ ...task, id: 8, projectId, title, description })),
    updateTaskDetails: vi.fn(async (id, title, description) => ({ ...task, id, title, description })),
    updateTaskStatus: vi.fn(async (id, status) => ({ ...task, id, status })),
    deleteTask: vi.fn(async () => {}),
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
    const { store } = setup();
    await store.load();

    const updated = await store.updateTaskStatus(task.id, "inProgress");
    expect(updated?.status).toBe("inProgress");
    expect(store.tasks[0].status).toBe("inProgress");

    expect(await store.deleteTask(task.id)).toBe(true);
    expect(store.tasks).toEqual([]);
  });

  it("keeps a task and exposes an error when deletion fails", async () => {
    const { store } = setup({ deleteTask: vi.fn(async () => Promise.reject(new Error("Git cleanup failed"))) });
    await store.load();

    expect(await store.deleteTask(task.id)).toBe(false);
    expect(store.tasks).toEqual([task]);
    expect(store.error).toBe("Git cleanup failed");
  });
});
