import { beforeEach, describe, expect, it, vi } from "vitest";
import { watch } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useHoverStore } from "./hover";

describe("useHoverStore", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sets, notifies once per change and ignores repeats", () => {
    const store = useHoverStore();
    const listener = vi.fn();
    watch(() => store.hoveredId, listener, { flush: "sync" });
    store.set("claude:a");
    store.set("claude:a");
    expect(store.hoveredId).toBe("claude:a");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clear only removes the id that is still hovered", () => {
    const store = useHoverStore();
    store.set("b");
    store.clear("a"); // stale leave from a previous target
    expect(store.hoveredId).toBe("b");
    store.clear("b");
    expect(store.hoveredId).toBeNull();
  });

  it("a consumer of one id only reacts when that id's state flips", () => {
    const store = useHoverStore();
    const listener = vi.fn();
    watch(() => store.hoveredId === "a", listener, { flush: "sync" });
    store.set("b");
    store.set("c");
    expect(listener).not.toHaveBeenCalled();
    store.set("a");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
