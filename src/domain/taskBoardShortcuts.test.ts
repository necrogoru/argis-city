import { describe, expect, it } from "vitest";
import {
  canCreateTaskFromBoard,
  canCreateTaskBranch,
  canOpenTaskTerminal,
  focusedVisibleTask,
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
  });

  it("does not take text entry from contenteditable or xterm input", () => {
    expect(taskBoardActionForShortcut(key("t"), target("div", { isContentEditable: true }))).toBeNull();
    expect(taskBoardActionForShortcut(key("t"), target("div", { matches: ".xterm-helper-textarea" }))).toBeNull();
  });

  it("ignores shortcuts while any dialog is open", () => {
    expect(taskBoardActionForShortcut(key("c"), target("button"), true)).toBeNull();
  });
});

describe("taskBoardNavigationDirection", () => {
  it("starts at the first or last visible task from outside a card", () => {
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("button"))).toBe("down");
    expect(taskBoardNavigationDirection(key("ArrowUp"), target("button"))).toBe("up");
  });

  it("leaves arrows to text fields, dialogs, and handlers that already consumed them", () => {
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("input"))).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown"), target("button"), true)).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown", { defaultPrevented: true }), target("button"))).toBeNull();
    expect(taskBoardNavigationDirection(key("ArrowDown", { isComposing: true }), target("button"))).toBeNull();
  });

  it("ignores keys other than up and down", () => {
    expect(taskBoardNavigationDirection(key("Enter"), target("button"))).toBeNull();
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
