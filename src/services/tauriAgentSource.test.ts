import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task } from "../domain/types";
import { createTauriAgentSource } from "./tauriAgentSource";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const project: Project = { id: 4, path: "/projects/argis" };
const task: Task = {
  id: 12,
  projectId: project.id,
  title: "Add task board",
  description: "Create the grouped view",
  status: "pending",
  branchName: null,
  worktreePath: null,
};

describe("TauriAgentSource project and task operations", () => {
  beforeEach(() => invoke.mockReset());

  it("registers a project path and returns the saved project", async () => {
    invoke.mockResolvedValue(project);

    await expect(createTauriAgentSource().addProject(project.path, true)).resolves.toEqual(project);

    expect(invoke).toHaveBeenCalledWith("register_project", { path: project.path, createIfMissing: true });
  });

  it("creates and lists tasks for a project", async () => {
    invoke.mockResolvedValueOnce(task).mockResolvedValueOnce([task]);
    const source = createTauriAgentSource();

    await expect(source.createTask(project.id, task.title, task.description)).resolves.toEqual(task);
    await expect(source.listTasks(project.id)).resolves.toEqual([task]);

    expect(invoke).toHaveBeenNthCalledWith(1, "create_task", {
      projectId: project.id,
      title: task.title,
      description: task.description,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "list_tasks", { projectId: project.id });
  });

  it("updates task fields, status and deletion through their commands", async () => {
    const deletion = {
      taskDeleted: true,
      git: {
        requested: true,
        worktreeRemoved: true,
        branchRemoved: true,
        branchName: "argis/12-add-task-board",
        worktreePath: "/projects/argis/.argis/worktrees/12-add-task-board",
        error: null,
      },
    };
    invoke.mockResolvedValueOnce(task).mockResolvedValueOnce({ ...task, status: "inProgress" }).mockResolvedValueOnce(deletion);
    const source = createTauriAgentSource();

    await source.updateTaskDetails(task.id, "Edited title", "Edited description");
    await source.updateTaskStatus(task.id, "inProgress");
    await expect(source.deleteTask(task.id, true)).resolves.toEqual(deletion);

    expect(invoke).toHaveBeenNthCalledWith(1, "update_task_details", {
      id: task.id,
      title: "Edited title",
      description: "Edited description",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "update_task_status", { id: task.id, status: "inProgress" });
    expect(invoke).toHaveBeenNthCalledWith(3, "delete_task", { id: task.id, removeGitResources: true });
  });

  it("checks Git capability and creates a task worktree through backend commands", async () => {
    const status = {
      isGitRepository: true,
      canCreateBranch: true,
      branchExists: false,
      branchName: "argis/12-add-task-board",
      worktreePath: "/projects/argis/.argis/worktrees/12-add-task-board",
      reason: null,
    };
    const worktree = { branchName: status.branchName, worktreePath: status.worktreePath };
    invoke.mockResolvedValueOnce(status).mockResolvedValueOnce(worktree);
    const source = createTauriAgentSource();

    await expect(source.getTaskGitStatus(task.id)).resolves.toEqual(status);
    await expect(source.createTaskWorktree(task.id)).resolves.toEqual(worktree);

    expect(invoke).toHaveBeenNthCalledWith(1, "inspect_task_git_status", { taskId: task.id });
    expect(invoke).toHaveBeenNthCalledWith(2, "create_task_worktree", { taskId: task.id });
  });
});
