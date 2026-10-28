import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "./types";
import {
  groupTasks,
  nextTaskStatus,
  previousTaskStatus,
  taskStatusForShortcut,
  taskBranchName,
  taskWorktreePath,
  TASK_STATUS_ORDER,
  TASK_STATUS_LABELS,
} from "./tasks";

function task(id: number, status: TaskStatus, projectId = 1): Task {
  return {
    id,
    projectId,
    title: `Task ${id}`,
    description: "Description",
    status,
    branchName: null,
    worktreePath: null,
    images: [],
  };
}

describe("task status order", () => {
  it("defines the agreed progression", () => {
    expect(TASK_STATUS_ORDER).toEqual(["pending", "inProgress", "stopped", "canceled", "completed"]);
  });

  it("returns adjacent statuses and no status beyond either boundary", () => {
    expect(TASK_STATUS_ORDER.map((status) => previousTaskStatus(status))).toEqual([
      null,
      "pending",
      "inProgress",
      "stopped",
      "canceled",
    ]);
    expect(TASK_STATUS_ORDER.map((status) => nextTaskStatus(status))).toEqual([
      "inProgress",
      "stopped",
      "canceled",
      "completed",
      null,
    ]);
  });

  it("provides one shared human-readable label for every task status", () => {
    expect(TASK_STATUS_LABELS).toEqual({
      pending: "Pending",
      inProgress: "In progress",
      stopped: "Stopped",
      canceled: "Canceled",
      completed: "Completed",
    });
  });

  it("maps number keys to statuses in the board order", () => {
    expect(["1", "2", "3", "4", "5"].map((key) => taskStatusForShortcut(statusKey(key)))).toEqual(
      TASK_STATUS_ORDER,
    );
    expect(taskStatusForShortcut(statusKey("0"))).toBeNull();
    expect(taskStatusForShortcut(statusKey("6"))).toBeNull();
    expect(taskStatusForShortcut(statusKey("s"))).toBeNull();
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("ignores %s status shortcuts", (_label, modifiers) => {
    expect(taskStatusForShortcut(statusKey("1", modifiers))).toBeNull();
  });
});

function statusKey(
  key: string,
  modifiers: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    defaultPrevented: boolean;
  }> = {},
) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...modifiers,
  };
}

describe("task Git names", () => {
  it("uses stable IDs and normalized title slugs", () => {
    expect(taskBranchName(27, "Ship cleanup (safe)!")).toBe("argis/27-ship-cleanup-safe");
    expect(taskBranchName(28, "🎨")).toBe("argis/28-task");
    expect(taskWorktreePath("/projects/argis/", 27, "Ship cleanup (safe)!")).toBe(
      "/projects/argis/.argis/worktrees/27-ship-cleanup-safe",
    );
  });
});

describe("groupTasks", () => {
  const tasks = [
    task(1, "pending", 1),
    task(2, "inProgress", 2),
    task(3, "stopped", 1),
    task(4, "canceled", 1),
    task(5, "completed", 2),
  ];

  it("places tasks into three groups without collapsing other statuses", () => {
    const groups = groupTasks(tasks);

    expect(groups.pending.map((item) => item.id)).toEqual([1]);
    expect(groups.inProgress.map((item) => item.id)).toEqual([2]);
    expect(groups.other.map((item) => item.status)).toEqual(["stopped", "canceled", "completed"]);
  });

  it("filters every group by project", () => {
    const groups = groupTasks(tasks, 1);

    expect(groups.pending.map((item) => item.id)).toEqual([1]);
    expect(groups.inProgress).toEqual([]);
    expect(groups.other.map((item) => item.id)).toEqual([3, 4]);
  });

  it("treats an all-projects filter the same as no filter", () => {
    expect(groupTasks(tasks, null)).toEqual(groupTasks(tasks));
  });
});
