import { describe, expect, it } from "vitest";
import type { Task, TerminalInventoryEntry } from "./types";
import {
  aggregateTerminalRailEntries,
  terminalRailStateLabel,
  type TerminalRailLiveStatusMap,
} from "./terminalRail";

const tasks: Task[] = [
  {
    id: 1,
    projectId: 1,
    title: "Idle task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/idle",
  },
  {
    id: 2,
    projectId: 1,
    title: "Running task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/running",
  },
  {
    id: 3,
    projectId: 1,
    title: "Pending task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/pending",
  },
  {
    id: 4,
    projectId: 1,
    title: "Completed task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/completed",
  },
  {
    id: 5,
    projectId: 1,
    title: "Unavailable task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/unavailable",
  },
  {
    id: 6,
    projectId: 1,
    title: "Inventory only task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/inventory-only",
  },
];

describe("aggregateTerminalRailEntries", () => {
  it("aggregates inventory and live tab states into idle, pending, running, completed, and unavailable rail states", () => {
    const inventory: TerminalInventoryEntry[] = [
      { taskId: 2, tab: "term", state: "running" },
      { taskId: 4, tab: "agent", state: "completed" },
      { taskId: 5, tab: "term", state: "failed" },
      { taskId: 6, tab: "agent", state: "completed" },
    ];
    const liveStatuses: TerminalRailLiveStatusMap = {
      2: { agent: "notStarted", term: "running" },
      3: { agent: "starting", term: "notStarted" },
      5: { agent: "error", term: "notStarted" },
    };

    expect(aggregateTerminalRailEntries(tasks, inventory, liveStatuses)).toEqual([
      expect.objectContaining({ taskId: 1, index: 1, title: "Idle task", state: "idle" }),
      expect.objectContaining({ taskId: 2, index: 2, title: "Running task", state: "running" }),
      expect.objectContaining({ taskId: 3, index: 3, title: "Pending task", state: "pending" }),
      expect.objectContaining({ taskId: 4, index: 4, title: "Completed task", state: "completed" }),
      expect.objectContaining({ taskId: 5, index: 5, title: "Unavailable task", state: "unavailable" }),
      expect.objectContaining({ taskId: 6, index: 6, title: "Inventory only task", state: "completed" }),
    ]);
  });

  it("prefers running over pending and pending over completed when tabs disagree", () => {
    const inventory: TerminalInventoryEntry[] = [{ taskId: 2, tab: "term", state: "completed" }];
    const liveStatuses: TerminalRailLiveStatusMap = {
      2: { agent: "starting", term: "running" },
    };

    expect(aggregateTerminalRailEntries(tasks.slice(1, 2), inventory, liveStatuses)).toEqual([
      expect.objectContaining({ taskId: 2, state: "running" }),
    ]);
  });
});

describe("terminalRailStateLabel", () => {
  it("returns accessible labels for each aggregate state", () => {
    expect(terminalRailStateLabel("idle")).toBe("Idle");
    expect(terminalRailStateLabel("pending")).toBe("Pending");
    expect(terminalRailStateLabel("running")).toBe("Running");
    expect(terminalRailStateLabel("completed")).toBe("Completed");
    expect(terminalRailStateLabel("unavailable")).toBe("Unavailable");
  });
});
