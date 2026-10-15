import { describe, expect, it } from "vitest";
import {
  adjacentVisibleTaskId,
  adjacentVerticalTaskId,
  nextVisibleTaskId,
  taskFocusDirectionForEvent,
  taskFocusDirectionForKey,
} from "./taskFocus";

describe("nextVisibleTaskId", () => {
  const visibleTaskIds = [12, 5, 30];

  it("starts at the first or last visible task when there is no focused task", () => {
    expect(nextVisibleTaskId(visibleTaskIds, null, "down")).toBe(12);
    expect(nextVisibleTaskId(visibleTaskIds, null, "up")).toBe(30);
  });

  it("moves through the visible task order in either direction", () => {
    expect(nextVisibleTaskId(visibleTaskIds, 5, "down")).toBe(30);
    expect(nextVisibleTaskId(visibleTaskIds, 5, "up")).toBe(12);
  });

  it("wraps between the first and last visible tasks", () => {
    expect(nextVisibleTaskId(visibleTaskIds, 30, "down")).toBe(12);
    expect(nextVisibleTaskId(visibleTaskIds, 12, "up")).toBe(30);
  });

  it("starts from the current result boundary when the focused task is no longer visible", () => {
    expect(nextVisibleTaskId(visibleTaskIds, 8, "down")).toBe(12);
    expect(nextVisibleTaskId(visibleTaskIds, 8, "up")).toBe(30);
  });

  it("returns null when there are no visible tasks", () => {
    expect(nextVisibleTaskId([], null, "down")).toBeNull();
    expect(nextVisibleTaskId([], 12, "up")).toBeNull();
  });
});

describe("adjacentVisibleTaskId", () => {
  const taskColumns = [[1, 2], [3], [], [4, 5, 6]];

  it("moves horizontally to the nearest populated column at the same row", () => {
    expect(adjacentVisibleTaskId(taskColumns, 1, "right")).toBe(3);
    expect(adjacentVisibleTaskId(taskColumns, 5, "left")).toBe(3);
  });

  it("clamps to the last task when the adjacent column has fewer rows", () => {
    expect(adjacentVisibleTaskId(taskColumns, 2, "right")).toBe(3);
    expect(adjacentVisibleTaskId(taskColumns, 6, "left")).toBe(3);
  });

  it("does not wrap at the outer columns or move without a focused task", () => {
    expect(adjacentVisibleTaskId(taskColumns, 1, "left")).toBeNull();
    expect(adjacentVisibleTaskId(taskColumns, 6, "right")).toBeNull();
    expect(adjacentVisibleTaskId(taskColumns, null, "right")).toBeNull();
  });
});

describe("adjacentVerticalTaskId", () => {
  const taskColumns = [[1, 2], [3], [], [4, 5, 6]];

  it("moves to the adjacent visible task in the same pane", () => {
    expect(adjacentVerticalTaskId(taskColumns, 1, "down")).toBe(2);
    expect(adjacentVerticalTaskId(taskColumns, 2, "up")).toBe(1);
  });

  it("stops at the first and last tasks instead of wrapping or crossing panes", () => {
    expect(adjacentVerticalTaskId(taskColumns, 2, "down")).toBeNull();
    expect(adjacentVerticalTaskId(taskColumns, 1, "up")).toBeNull();
    expect(adjacentVerticalTaskId(taskColumns, 3, "down")).toBeNull();
    expect(adjacentVerticalTaskId(taskColumns, 3, "up")).toBeNull();
  });

  it("uses only the filtered visible tasks in each pane", () => {
    const filteredColumns = [[12], [30, 18]];

    expect(adjacentVerticalTaskId(filteredColumns, 30, "down")).toBe(18);
    expect(adjacentVerticalTaskId(filteredColumns, 18, "up")).toBe(30);
    expect(adjacentVerticalTaskId(filteredColumns, 12, "down")).toBeNull();
  });

  it("returns null for an empty board, missing focus, or an unfocused task", () => {
    expect(adjacentVerticalTaskId([], 1, "down")).toBeNull();
    expect(adjacentVerticalTaskId(taskColumns, null, "down")).toBeNull();
    expect(adjacentVerticalTaskId(taskColumns, 99, "up")).toBeNull();
  });
});

describe("taskFocusDirectionForKey", () => {
  it.each([
    ["ArrowLeft", "left"], ["h", "left"],
    ["ArrowDown", "down"], ["j", "down"],
    ["ArrowUp", "up"], ["k", "up"],
    ["ArrowRight", "right"], ["l", "right"],
  ] as const)("maps %s to %s", (key, direction) => {
    expect(taskFocusDirectionForKey({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false })).toBe(direction);
  });

  it("ignores modified or unrelated keys", () => {
    expect(taskFocusDirectionForKey({ key: "h", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBeNull();
    expect(taskFocusDirectionForKey({ key: "x", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false })).toBeNull();
  });
});

describe("taskFocusDirectionForEvent", () => {
  const event = (key: string) => ({
    key,
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  });

  it("allows arrow navigation from a descendant inside a task card", () => {
    expect(taskFocusDirectionForEvent(event("ArrowDown"), true)).toBe("down");
    expect(taskFocusDirectionForEvent(event("ArrowUp"), true)).toBe("up");
    expect(taskFocusDirectionForEvent(event("l"), true)).toBe("right");
  });

  it("ignores events outside a task card and composition input", () => {
    expect(taskFocusDirectionForEvent(event("ArrowDown"), false)).toBeNull();
    expect(taskFocusDirectionForEvent({ ...event("ArrowDown"), isComposing: true }, true)).toBeNull();
    expect(taskFocusDirectionForEvent(event("Enter"), true)).toBeNull();
  });
});
