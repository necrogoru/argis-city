import { describe, expect, it } from "vitest";
import {
  canCreateTaskFromBoard,
  canCreateTaskBranch,
  canOpenTaskTerminal,
  focusedVisibleTask,
  resolveTaskBoardJumpShortcut,
  taskBoardActionForShortcut,
  taskBoardNavigationDirection,
} from "./taskBoardShortcuts";

const key = (
  value: string,
  modifiers: Partial<
    Record<
      "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented",
      boolean
    >
  > = {},
) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...modifiers,
});

const target = (tagName: string, options: { isContentEditable?: boolean; matches?: string } = {}) => ({
  tagName,
  isContentEditable: options.isContentEditable ?? false,
  closest: (selector: string) => (selector === options.matches ? {} : null),
});

describe("taskBoardActionForShortcut", () => {
  it.each([
    ["c", "createTask"],
    ["b", "createBranch"],
    ["t", "openTerminal"],
    ["s", "changeStatus"],
    ["C", "createTask"],
  ] as const)("maps %s to %s", (value, action) => {
    expect(taskBoardActionForShortcut(key(value), target("button"))).toBe(action);
  });

  it("ignores unrelated keys", () => {
    expect(taskBoardActionForShortcut(key("x"), target("button"))).toBeNull();
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
  ] as const)("ignores %s keystrokes", (_label, modifiers) => {
    expect(taskBoardActionForShortcut(key("b", modifiers), target("button"))).toBeNull();
  });

  it.each(["input", "textarea", "select"])("does not take text entry from %s", (tagName) => {
    expect(taskBoardActionForShortcut(key("c"), target(tagName))).toBeNull();
    expect(taskBoardActionForShortcut(key("s"), target(tagName))).toBeNull();
  });

  it("does not take text entry from contenteditable or xterm input", () => {
    expect(taskBoardActionForShortcut(key("t"), target("div", { isContentEditable: true }))).toBeNull();
    expect(taskBoardActionForShortcut(key("t"), target("div", { matches: ".xterm-helper-textarea" }))).toBeNull();
    expect(taskBoardActionForShortcut(key("s"), target("div", { isContentEditable: true }))).toBeNull();
    expect(taskBoardActionForShortcut(key("s"), target("div", { matches: ".xterm-helper-textarea" }))).toBeNull();
  });

  it("ignores shortcuts while any dialog is open", () => {
    expect(taskBoardActionForShortcut(key("c"), target("button"), true)).toBeNull();
    expect(taskBoardActionForShortcut(key("s"), target("button"), true)).toBeNull();
  });
});

describe("taskBoardNavigationDirection", () => {
  it("starts at the first or last visible task from outside a card", () => {
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("button"))).toBe("down");
    expect(taskBoardNavigationDirection(key("ArrowUp"), target("button"))).toBe("up");
  });

  it.each([
    ["ArrowLeft", "left"], ["h", "left"],
    ["ArrowDown", "down"], ["j", "down"],
    ["ArrowUp", "up"], ["k", "up"],
    ["ArrowRight", "right"], ["l", "right"],
  ] as const)("maps %s to %s outside a task card", (value, direction) => {
    expect(taskBoardNavigationDirection(key(value), target("button"))).toBe(direction);
  });

  it("leaves arrows to text fields, dialogs, and handlers that already consumed them", () => {
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("input"))).toBeNull();
    expect(taskBoardNavigationDirection(key("h"), target("input"))).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("button"), true)).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown", { defaultPrevented: true }), target("button"))).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown", { isComposing: true }), target("button"))).toBeNull();
  });

  it("ignores keys other than up and down", () => {
    expect(taskBoardNavigationDirection(key("Enter"), target("button"))).toBeNull();
  });
});

describe("resolveTaskBoardJumpShortcut", () => {
  const visibleTaskIds = [12, 5, 30];

  it("recognizes gg within 500 ms and targets the first visible task", () => {
    const firstG = resolveTaskBoardJumpShortcut(key("g"), target("button"), visibleTaskIds, null, 100);
    const secondG = resolveTaskBoardJumpShortcut(key("g"), target("button"), visibleTaskIds, firstG.pendingGAtMs, 600);

    expect(firstG).toEqual({ taskId: null, pendingGAtMs: 100 });
    expect(secondG).toEqual({ taskId: 12, pendingGAtMs: null });
  });

  it("expires an old g and starts a fresh sequence", () => {
    const result = resolveTaskBoardJumpShortcut(key("g"), target("button"), visibleTaskIds, 100, 601);

    expect(result).toEqual({ taskId: null, pendingGAtMs: 601 });
  });

  it("uses uppercase G to target the last visible task", () => {
    const result = resolveTaskBoardJumpShortcut(
      key("G", { shiftKey: true }),
      target("button"),
      visibleTaskIds,
      100,
      150,
    );

    expect(result).toEqual({ taskId: 30, pendingGAtMs: null });
  });

  it("clears a pending g when another key interrupts the sequence", () => {
    const result = resolveTaskBoardJumpShortcut(key("x"), target("button"), visibleTaskIds, 100, 150);

    expect(result).toEqual({ taskId: null, pendingGAtMs: null });
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("does not resolve a modified, %s, or composing event", (_label, modifiers) => {
    const result = resolveTaskBoardJumpShortcut(
      key("g", modifiers),
      target("button"),
      visibleTaskIds,
      100,
      150,
    );

    expect(result).toEqual({ taskId: null, pendingGAtMs: null });
  });

  it.each(["input", "textarea", "select"])("does not take a sequence from %s", (tagName) => {
    const result = resolveTaskBoardJumpShortcut(key("g"), target(tagName), visibleTaskIds, 100, 150);

    expect(result).toEqual({ taskId: null, pendingGAtMs: null });
  });

  it("clears a pending sequence while a dialog is open or focus is editable", () => {
    expect(resolveTaskBoardJumpShortcut(key("g"), target("button"), visibleTaskIds, 100, 150, true)).toEqual({
      taskId: null,
      pendingGAtMs: null,
    });
    expect(
      resolveTaskBoardJumpShortcut(key("g"), target("div", { isContentEditable: true }), visibleTaskIds, 100, 150),
    ).toEqual({ taskId: null, pendingGAtMs: null });
    expect(
      resolveTaskBoardJumpShortcut(key("g"), target("div", { matches: ".xterm-helper-textarea" }), visibleTaskIds, 100, 150),
    ).toEqual({ taskId: null, pendingGAtMs: null });
  });

  it("does not return a jump target for an empty or filtered-out board", () => {
    expect(resolveTaskBoardJumpShortcut(key("G", { shiftKey: true }), target("button"), [], null, 100)).toEqual({
      taskId: null,
      pendingGAtMs: null,
    });
    const firstG = resolveTaskBoardJumpShortcut(key("g"), target("button"), [], null, 100);
    expect(resolveTaskBoardJumpShortcut(key("g"), target("button"), [], firstG.pendingGAtMs, 200)).toEqual({
      taskId: null,
      pendingGAtMs: null,
    });
  });
});

describe("task board shortcut action eligibility", () => {
  it("resolves only the focused task when it remains visible after filtering", () => {
    const tasks = [{ id: 2, title: "Second" }, { id: 5, title: "Fifth" }];

    expect(focusedVisibleTask(5, [2, 5], tasks)).toEqual(tasks[1]);
    expect(focusedVisibleTask(2, [5], tasks)).toBeNull();
    expect(focusedVisibleTask(null, [2, 5], tasks)).toBeNull();
  });

  it("allows creating a task only when the New task button is enabled", () => {
    expect(canCreateTaskFromBoard(0)).toBe(false);
    expect(canCreateTaskFromBoard(1)).toBe(true);
  });

  it("allows branch creation only when Git permits it and the task has no branch", () => {
    expect(canCreateTaskBranch({ branchName: null }, { canCreateBranch: true })).toBe(true);
    expect(canCreateTaskBranch({ branchName: null }, { canCreateBranch: false })).toBe(false);
    expect(canCreateTaskBranch({ branchName: null }, null)).toBe(false);
    expect(canCreateTaskBranch({ branchName: "task/7-example" }, { canCreateBranch: true })).toBe(false);
  });

  it("allows terminal opening only when a worktree exists and the terminal action is enabled", () => {
    expect(canOpenTaskTerminal({ worktreePath: "/tmp/argis-task-7" }, true)).toBe(true);
    expect(canOpenTaskTerminal({ worktreePath: "/tmp/argis-task-7" }, false)).toBe(false);
    expect(canOpenTaskTerminal({ worktreePath: null }, true)).toBe(false);
  });
});
