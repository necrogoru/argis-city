import { describe, expect, it, vi } from "vitest";
import { createHoverStore } from "./hoverStore";

describe("hoverStore", () => {
  it("sets, notifies once per change and ignores repeats", () => {
    const store = createHoverStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("claude:a");
    store.set("claude:a");
    expect(store.get()).toBe("claude:a");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clear only removes the id that is still hovered", () => {
    const store = createHoverStore();
    store.set("b");
    store.clear("a"); // stale leave from a previous target
    expect(store.get()).toBe("b");
    store.clear("b");
    expect(store.get()).toBeNull();
  });

  it("unsubscribes", () => {
    const store = createHoverStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.set("x");
    expect(listener).not.toHaveBeenCalled();
  });
});
