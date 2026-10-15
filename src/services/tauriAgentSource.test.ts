import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task, TerminalAttachment, TerminalEvent, TerminalInventoryEntry } from "../domain/types";
import { createTauriAgentSource } from "./tauriAgentSource";

const { invoke, channelHandlers } = vi.hoisted(() => ({
  invoke: vi.fn(),
  channelHandlers: [] as Array<(message: unknown) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  Channel: class {
    private handler: (message: unknown) => void = () => {};

    constructor() {
      channelHandlers.push((message) => this.handler(message));
    }

    set onmessage(handler: (message: unknown) => void) {
      this.handler = handler;
    }

    get onmessage(): (message: unknown) => void {
      return this.handler;
    }
  },
}));

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
  beforeEach(() => {
    invoke.mockReset();
    channelHandlers.length = 0;
  });

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

  it("streams terminal channel events and forwards terminal input and size", async () => {
    const attachment: TerminalAttachment = {
      session: {
        id: 22,
        key: { taskId: task.id, tab: "agent" },
        agentCli: "claude",
        processId: 771,
        running: true,
      },
      attachmentId: 5,
    };
    const output = vi.fn<(event: TerminalEvent) => void>();
    const event: TerminalEvent = { type: "output", sessionId: attachment.session.id, bytes: [65, 10] };
    invoke.mockResolvedValueOnce(attachment).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    const source = createTauriAgentSource();

    await expect(source.startTerminalSession(task.id, "agent", "claude", { cols: 90, rows: 30 }, output))
      .resolves.toEqual(attachment);
    channelHandlers[0](event);
    await source.sendTerminalInput(attachment.session.id, "hello\n");
    await source.resizeTerminalSession(attachment.session.id, { cols: 110, rows: 36 });

    expect(output).toHaveBeenCalledWith(event);
    expect(invoke).toHaveBeenNthCalledWith(1, "start_terminal_session", {
      taskId: task.id,
      tab: "agent",
      agentCli: "claude",
      size: { cols: 90, rows: 30 },
      onEvent: expect.any(Object),
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "terminal_input", {
      sessionId: attachment.session.id,
      data: "hello\n",
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "resize_terminal_session", {
      sessionId: attachment.session.id,
      size: { cols: 110, rows: 36 },
    });
  });

  it("reattaches to a running task tab and detaches its output channel without stopping it", async () => {
    const attachment: TerminalAttachment = {
      session: {
        id: 23,
        key: { taskId: task.id, tab: "term" },
        agentCli: null,
        processId: 772,
        running: true,
      },
      attachmentId: 6,
    };
    const output = vi.fn<(event: TerminalEvent) => void>();
    invoke.mockResolvedValueOnce(attachment).mockResolvedValueOnce(true);
    const source = createTauriAgentSource();

    await expect(source.reattachTerminalSession(task.id, "term", output)).resolves.toEqual(attachment);
    channelHandlers[0]({ type: "output", sessionId: attachment.session.id, bytes: [65] } satisfies TerminalEvent);
    await source.detachTerminalSession(task.id, "term", attachment.attachmentId);
    channelHandlers[0]({ type: "output", sessionId: attachment.session.id, bytes: [66] } satisfies TerminalEvent);

    expect(output).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenNthCalledWith(1, "reattach_terminal_session", {
      taskId: task.id,
      tab: "term",
      onEvent: expect.any(Object),
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "detach_terminal_session", {
      taskId: task.id,
      tab: "term",
      attachmentId: attachment.attachmentId,
    });
  });

  it("loads the Argis-managed terminal inventory through its dedicated command", async () => {
    const inventory: TerminalInventoryEntry[] = [
      { taskId: task.id, tab: "agent", state: "running" },
      { taskId: task.id, tab: "term", state: "completed" },
    ];
    invoke.mockResolvedValueOnce(inventory);

    await expect(createTauriAgentSource().listTerminalInventory()).resolves.toEqual(inventory);

    expect(invoke).toHaveBeenCalledWith("list_terminal_inventory");
  });
});
