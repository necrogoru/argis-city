import { describe, expect, it } from "vitest";
import type { Task } from "./types";
import { findTaskTerminalMatch, normalizeAbsolutePath } from "./taskTerminalMatch";

const task = (id: number, worktreePath: string | null): Task => ({
  id,
  projectId: 1,
  title: `Task ${id}`,
  description: "",
  status: "pending",
  branchName: null,
  worktreePath,
});

describe("normalizeAbsolutePath", () => {
  it("normalizes separators, redundant segments, and trailing separators", () => {
    expect(normalizeAbsolutePath("/Users/dev/project//.argis/worktrees/./7-task/"))
      .toBe("/Users/dev/project/.argis/worktrees/7-task");
    expect(normalizeAbsolutePath("/Users/dev/project/.argis/worktrees/8-task/../7-task"))
      .toBe("/Users/dev/project/.argis/worktrees/7-task");
  });

  it("normalizes absolute Windows paths without depending on Node path APIs", () => {
    expect(normalizeAbsolutePath("C:\\Users\\Dev\\worktrees\\7-task\\"))
      .toBe(normalizeAbsolutePath("c:/users/dev/worktrees/7-task"));
    expect(normalizeAbsolutePath("\\\\Server\\Share\\worktrees\\7-task"))
      .toBe("//server/share/worktrees/7-task");
  });

  it("rejects relative and empty paths", () => {
    expect(normalizeAbsolutePath("project/worktree")).toBeNull();
    expect(normalizeAbsolutePath("")).toBeNull();
  });
});

describe("findTaskTerminalMatch", () => {
  it("retains house matching for a task omitted from the In progress-only rail", () => {
    const tasks = [task(7, "/worktrees/7-task/"), task(8, "/worktrees/8-task")];

    expect(findTaskTerminalMatch("/worktrees/7-task", tasks, [{ taskId: 7 }])).toEqual(tasks[0]);
    expect(findTaskTerminalMatch("/worktrees/7-task", tasks, [{ taskId: 8 }])).toBeNull();
  });

  it("does not expose a terminal for an unmatched cwd or a stale relative worktree", () => {
    expect(findTaskTerminalMatch("/worktrees/9-task", [task(9, "/old/9-task")], [{ taskId: 9 }])).toBeNull();
    expect(findTaskTerminalMatch("/worktrees/9-task", [task(9, "worktrees/9-task")], [{ taskId: 9 }])).toBeNull();
    expect(findTaskTerminalMatch("relative/9-task", [task(9, "/worktrees/9-task")], [{ taskId: 9 }])).toBeNull();
    expect(findTaskTerminalMatch("/worktrees/9-task", [task(9, null)], [{ taskId: 9 }])).toBeNull();
  });
});
