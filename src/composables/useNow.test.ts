import { afterEach, describe, expect, it, vi } from "vitest";

describe("useNow", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ticks once per second on a timer (never per animation frame)", async () => {
    // VueUse only starts timers in a browser: look like one before it loads.
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("document", { createElement: () => ({}) });
    vi.resetModules();
    const { useNow } = await import("./useNow");

    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const now = useNow();
    const start = now.value;
    vi.setSystemTime(10_500);
    vi.advanceTimersByTime(999);
    expect(now.value).toBe(start);
    vi.advanceTimersByTime(1);
    expect(now.value).toBeGreaterThan(start);
  });
});
