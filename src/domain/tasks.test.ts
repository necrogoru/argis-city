import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "./types";
import { groupTasks, nextTaskStatus, previousTaskStatus, TASK_STATUS_ORDER } from "./tasks";

function task(id: number, status: TaskStatus, projectId = 1): Task {
  return {
    id,
    projectId,
    title: `Task ${id}`,
    description: "Description",
    status,
    branchName: null,
    worktreePath: null,
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
