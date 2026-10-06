import { describe, expect, it } from "vitest";
import { useHoverSources } from "./useHoverSources";

/** The hover store's contract: `clear` only clears its own id. */
function hoverStore() {
  const store = {
    hoveredId: null as string | null,
    set(id: string) {
      store.hoveredId = id;
    },
    clear(id: string) {
      if (store.hoveredId === id) store.hoveredId = null;
    },
  };
  return store;
}

describe("useHoverSources", () => {
  it("keeps the house hovered when the pointer moves from the house onto its own label", () => {
    const hover = hoverStore();
    const sources = useHoverSources(() => "a", hover);
    sources.meshOver();
    // The label's DOM pointerenter arrives before the canvas's batched pointerout.
    sources.labelEnter();
    sources.meshOut();
    expect(hover.hoveredId).toBe("a");
    expect(sources.mesh.value).toBe(false);
  });

  it("clears once neither the house nor its label is under the pointer", () => {
    const hover = hoverStore();
    const sources = useHoverSources(() => "a", hover);
    sources.labelEnter();
    sources.meshOver();
    sources.labelLeave();
    expect(hover.hoveredId).toBe("a");
    sources.meshOut();
    expect(hover.hoveredId).toBeNull();
  });

  it("leaving a source that was never entered leaves another hover alone", () => {
    const hover = hoverStore();
    const sources = useHoverSources(() => "a", hover);
    hover.set("a"); // e.g. the pointer is on this session's agent-list row
    sources.labelLeave();
    sources.meshOut();
    expect(hover.hoveredId).toBe("a");
  });
});
