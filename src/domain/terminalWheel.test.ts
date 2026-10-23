import { describe, expect, it } from "vitest";
import { normalizeAlternateBufferWheelDelta } from "./terminalWheel";

describe("normalizeAlternateBufferWheelDelta", () => {
  it("promotes small pixel deltas to one line in the alternate buffer", () => {
    expect(normalizeAlternateBufferWheelDelta(12, 0, "alternate")).toBe(50);
    expect(normalizeAlternateBufferWheelDelta(-12, 0, "alternate")).toBe(-50);
  });

  it("leaves normal-buffer, line-mode, zero, and already-large events unchanged", () => {
    expect(normalizeAlternateBufferWheelDelta(12, 0, "normal")).toBeNull();
    expect(normalizeAlternateBufferWheelDelta(12, 1, "alternate")).toBeNull();
    expect(normalizeAlternateBufferWheelDelta(0, 0, "alternate")).toBeNull();
    expect(normalizeAlternateBufferWheelDelta(50, 0, "alternate")).toBeNull();
  });
});
