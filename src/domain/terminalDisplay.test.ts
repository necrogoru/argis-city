import { describe, expect, it } from "vitest";
import { fullTerminalRefreshRange } from "./terminalDisplay";

describe("fullTerminalRefreshRange", () => {
  it("covers every row in the current viewport", () => {
    expect(fullTerminalRefreshRange(1)).toEqual([0, 0]);
    expect(fullTerminalRefreshRange(42)).toEqual([0, 41]);
  });

  it("does not produce an invalid range for an empty viewport", () => {
    expect(fullTerminalRefreshRange(0)).toBeNull();
  });
});
