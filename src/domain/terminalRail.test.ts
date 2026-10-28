import { describe, expect, it } from "vitest";
import type { Task, TaskAgentResume, TerminalInventoryEntry } from "./types";
import {
  aggregateTerminalRailEntries,
  filterInProgressTerminalRailEntries,
  resolveTerminalRailFocusChord,
  terminalRailNavigationDirection,
  terminalRailEntryLabel,
  terminalRailStateLabel,
  terminalRailTitlePreview,
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
    images: [],
  },
  {
    id: 2,
    projectId: 1,
    title: "Running task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/running",
    images: [],
  },
  {
    id: 3,
    projectId: 1,
    title: "Pending task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/pending",
    images: [],
  },
  {
    id: 4,
    projectId: 1,
    title: "Completed task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/completed",
    images: [],
  },
  {
    id: 5,
    projectId: 1,
    title: "Unavailable task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/unavailable",
    images: [],
  },
  {
    id: 6,
    projectId: 1,
    title: "Inventory only task",
    description: "",
    status: "pending",
    branchName: null,
    worktreePath: "/worktrees/inventory-only",
    images: [],
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

  it("filters rendered rail entries by task workflow status, not terminal activity", () => {
    const workflowStatus: Record<number, Task["status"]> = {
      1: "inProgress",
      2: "pending",
      3: "inProgress",
      4: "completed",
      5: "stopped",
      6: "canceled",
    };
    const workflowTasks: Task[] = tasks.map((task) => ({
      ...task,
      status: workflowStatus[task.id],
    }));
    const entries = aggregateTerminalRailEntries(
      workflowTasks,
      [{ taskId: 2, tab: "agent", state: "running" }],
      {},
    );

    expect(filterInProgressTerminalRailEntries(entries, workflowTasks).map((entry) => entry.taskId)).toEqual([1, 3]);
    expect(entries.map((entry) => entry.taskId)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(entries.find((entry) => entry.taskId === 1)?.state).toBe("idle");
    expect(entries.find((entry) => entry.taskId === 2)?.state).toBe("running");
  });

  it("keeps a saved conversation discoverable when no managed terminal is running", () => {
    const resumes: TaskAgentResume[] = [{
      taskId: 4,
      provider: "codex",
      nativeReference: "opaque-native-id",
      worktreePath: "/worktrees/completed",
      lastObservedAtMs: 100,
    }];

    expect(aggregateTerminalRailEntries(tasks, [], {}, resumes)).toContainEqual(
      expect.objectContaining({ taskId: 4, state: "resumable", resumeProvider: "codex" }),
    );
    expect(terminalRailStateLabel("resumable")).toBe("Resumable");
    expect(terminalRailEntryLabel({ taskId: 4, index: 4, title: tasks[3].title, state: "resumable", resumeProvider: "codex" }))
      .toBe("Resume Codex");
  });

  it("keeps running terminal status ahead of a saved conversation reference", () => {
    const resumes: TaskAgentResume[] = [{
      taskId: 2,
      provider: "claude",
      nativeReference: "opaque-native-id",
      worktreePath: "/worktrees/running",
      lastObservedAtMs: 100,
    }];

    expect(aggregateTerminalRailEntries(tasks, [{ taskId: 2, tab: "agent", state: "running" }], {}, resumes))
      .toContainEqual(expect.objectContaining({ taskId: 2, state: "running", resumeProvider: "claude" }));
  });
});

describe("terminalRailStateLabel", () => {
  it("returns accessible labels for each aggregate state", () => {
    expect(terminalRailStateLabel("idle")).toBe("Idle");
    expect(terminalRailStateLabel("pending")).toBe("Pending");
    expect(terminalRailStateLabel("running")).toBe("Running");
    expect(terminalRailStateLabel("completed")).toBe("Completed");
    expect(terminalRailStateLabel("resumable")).toBe("Resumable");
    expect(terminalRailStateLabel("unavailable")).toBe("Unavailable");
  });
});

describe("terminalRailTitlePreview", () => {
  it("shows at most the first 10 characters", () => {
    expect(terminalRailTitlePreview("0123456789abc")).toBe("0123456789");
  });

  it("keeps titles shorter than 10 characters intact", () => {
    expect(terminalRailTitlePreview("Argis UI")).toBe("Argis UI");
  });
});

describe("terminalRailNavigationDirection", () => {
  const keyEvent = (key: string, overrides: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    defaultPrevented: boolean;
  }> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  });

  it.each([
    ["ArrowDown", "down"], ["j", "down"],
    ["ArrowUp", "up"], ["k", "up"],
  ] as const)("maps %s to %s", (key, direction) => {
    expect(terminalRailNavigationDirection(keyEvent(key), true)).toBe(direction);
  });

  it("does not navigate outside a focused launcher or for unrelated keys", () => {
    expect(terminalRailNavigationDirection(keyEvent("j"), false)).toBeNull();
    expect(terminalRailNavigationDirection(keyEvent("Enter"), true)).toBeNull();
  });

  it("ignores modified, composing, prevented, or repeated Vim-key events", () => {
    expect(terminalRailNavigationDirection(keyEvent("j", { metaKey: true }), true)).toBeNull();
    expect(terminalRailNavigationDirection(keyEvent("k", { shiftKey: true }), true)).toBeNull();
    expect(terminalRailNavigationDirection(keyEvent("j", { isComposing: true }), true)).toBeNull();
    expect(terminalRailNavigationDirection(keyEvent("k", { defaultPrevented: true }), true)).toBeNull();
    expect(terminalRailNavigationDirection(keyEvent("j", { repeat: true }), true)).toBeNull();
  });
});

describe("resolveTerminalRailFocusChord", () => {
  const keyEvent = (key: string, overrides: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    defaultPrevented: boolean;
  }> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  });

  const target = (
    tagName: string,
    options: { isContentEditable?: boolean; matches?: string } = {},
  ) => ({
    tagName,
    isContentEditable: options.isContentEditable ?? false,
    closest: (selector: string) => (selector === options.matches ? {} : null),
  });

  it("resolves g then r within the shared 500 ms window", () => {
    const first = resolveTerminalRailFocusChord(keyEvent("g"), target("body"), false, null, 100);

    expect(first).toEqual({ focusFirstLauncher: false, pendingGAtMs: 100 });
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target("body"), false, first.pendingGAtMs, 600)).toEqual({
      focusFirstLauncher: true,
      pendingGAtMs: null,
    });
  });

  it("does not focus the rail for r alone or an expired g", () => {
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target("body"), false, null, 100)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target("body"), false, 100, 601)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it("clears a pending g when another key interrupts the sequence", () => {
    expect(resolveTerminalRailFocusChord(keyEvent("j"), target("body"), false, 100, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it("keeps view chords and the rail chord apart", () => {
    const pending = resolveTerminalRailFocusChord(keyEvent("g"), target("body"), false, null, 100).pendingGAtMs;

    expect(resolveTerminalRailFocusChord(keyEvent("d"), target("body"), false, pending, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
    expect(resolveTerminalRailFocusChord(keyEvent("t"), target("body"), false, pending, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("does not start the chord with %s", (_label, modifiers) => {
    expect(resolveTerminalRailFocusChord(keyEvent("g", modifiers), target("body"), false, null, 100)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("does not complete the chord with %s", (_label, modifiers) => {
    expect(resolveTerminalRailFocusChord(keyEvent("r", modifiers), target("body"), false, 100, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it.each(["input", "textarea", "select"])("does not take the chord from %s", (tagName) => {
    expect(resolveTerminalRailFocusChord(keyEvent("g"), target(tagName), false, null, 100)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target(tagName), false, 100, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it("does not take the chord from contenteditable or terminal input", () => {
    expect(
      resolveTerminalRailFocusChord(keyEvent("g"), target("div", { isContentEditable: true }), false, null, 100),
    ).toEqual({ focusFirstLauncher: false, pendingGAtMs: null });
    expect(
      resolveTerminalRailFocusChord(keyEvent("r"), target("div", { matches: ".xterm-helper-textarea" }), false, 100, 150),
    ).toEqual({ focusFirstLauncher: false, pendingGAtMs: null });
  });

  it("clears a pending sequence while a dialog is open", () => {
    expect(resolveTerminalRailFocusChord(keyEvent("g"), target("body"), true, null, 100)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target("body"), true, 100, 150)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: null,
    });
  });

  it("allows the chord from non-editable page controls", () => {
    expect(resolveTerminalRailFocusChord(keyEvent("g"), target("button"), false, null, 100)).toEqual({
      focusFirstLauncher: false,
      pendingGAtMs: 100,
    });
    expect(resolveTerminalRailFocusChord(keyEvent("r"), target("button"), false, 100, 150)).toEqual({
      focusFirstLauncher: true,
      pendingGAtMs: null,
    });
  });
});
