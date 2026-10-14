import { describe, expect, it } from "vitest";
import type { Task } from "../../domain/types";
import { taskPaletteAction } from "./taskPaletteAction";

const task: Task = {
  id: 17,
  projectId: 1,
  title: "Search tasks",
  description: "",
  status: "pending",
  branchName: null,
  worktreePath: null,
};

describe("taskPaletteAction", () => {
  it("opens the terminal for a task with a worktree", () => {
    expect(taskPaletteAction({ ...task, worktreePath: "/projects/app/.argis/worktrees/17-search" })).toBe(
      "open-terminal",
    );
  });

  it("offers Tasks as the explicit route for a task without a worktree", () => {
    expect(taskPaletteAction(task)).toBe("open-tasks");
  });
});
