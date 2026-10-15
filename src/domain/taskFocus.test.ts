import { describe, expect, it } from "vitest";
import { nextVisibleTaskId, taskFocusDirectionForEvent } from "./taskFocus";

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

describe("taskFocusDirectionForEvent", () => {
  it("allows arrow navigation from a descendant inside a task card", () => {
    expect(taskFocusDirectionForEvent({ key: "ArrowDown", isComposing: false }, true)).toBe("down");
    expect(taskFocusDirectionForEvent({ key: "ArrowUp", isComposing: false }, true)).toBe("up");
  });

  it("ignores events outside a task card and composition input", () => {
    expect(taskFocusDirectionForEvent({ key: "ArrowDown", isComposing: false }, false)).toBeNull();
    expect(taskFocusDirectionForEvent({ key: "ArrowDown", isComposing: true }, true)).toBeNull();
    expect(taskFocusDirectionForEvent({ key: "Enter", isComposing: false }, true)).toBeNull();
  });
});
