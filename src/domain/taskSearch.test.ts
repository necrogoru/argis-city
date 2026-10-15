import { describe, expect, it } from "vitest";
import { groupTasks } from "./tasks";
import { searchBoardTasks } from "./taskSearch";
import type { Project, Task } from "./types";

const projects: Project[] = [
  { id: 1, path: "/work/argis-app/" },
  { id: 2, path: "C:\\work\\keyboard-terminals" },
];

const tasks: Task[] = [
  {
    id: 8,
    projectId: 2,
    title: "Implement terminal routing",
    description: "Connect keyboard navigation to task terminals",
    status: "inProgress",
    branchName: null,
    worktreePath: null,
  },
  {
    id: 5,
    projectId: 1,
    title: "Add task workspace",
    description: "Group work by status",
    status: "pending",
    branchName: null,
    worktreePath: null,
  },
  {
    id: 6,
    projectId: 1,
    title: "Polish board layout",
    description: "Review task card spacing",
    status: "pending",
    branchName: null,
    worktreePath: null,
  },
];

const ids = (items: Task[]) => items.map((task) => task.id);

describe("searchBoardTasks", () => {
  it("matches task IDs, titles, descriptions, project names, and project paths", () => {
    expect(ids(searchBoardTasks(tasks, projects, "8"))).toEqual([8]);
    expect(ids(searchBoardTasks(tasks, projects, "#8"))).toEqual([8]);
    expect(ids(searchBoardTasks(tasks, projects, "terminal routing"))).toEqual([8]);
    expect(ids(searchBoardTasks(tasks, projects, "keyboard-terminals"))).toEqual([8]);
    expect(ids(searchBoardTasks(tasks, projects, "/work/argis-app"))).toEqual([5, 6]);
  });

  it("intersects text search with the existing project filter", () => {
    expect(ids(searchBoardTasks(tasks, projects, "", 1))).toEqual([5, 6]);
    expect(ids(searchBoardTasks(tasks, projects, "workspace", 1))).toEqual([5]);
    expect(searchBoardTasks(tasks, projects, "terminal", 1)).toEqual([]);
  });

  it("keeps input order so status groups retain their board order", () => {
    const matches = searchBoardTasks(tasks, projects, "task");
    const groups = groupTasks(matches);

    expect(ids(matches)).toEqual([8, 5, 6]);
    expect(ids(groups.inProgress)).toEqual([8]);
    expect(ids(groups.pending)).toEqual([5, 6]);
  });

  it("returns all eligible tasks in input order for an empty or whitespace query", () => {
    expect(ids(searchBoardTasks(tasks, projects, "   "))).toEqual([8, 5, 6]);
    expect(ids(searchBoardTasks(tasks, projects, "  ", 1))).toEqual([5, 6]);
  });

  it("returns no tasks when no fields match", () => {
    expect(searchBoardTasks(tasks, projects, "missing-term")).toEqual([]);
  });
});
