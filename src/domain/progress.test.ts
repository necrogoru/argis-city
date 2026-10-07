import { describe, expect, it } from "vitest";
import { clampPercent, displayProgress, progressFraction } from "./progress";

describe("displayProgress", () => {
  it("labels plan progress as execution with step detail", () => {
    const d = displayProgress({ percent: 62.5, source: "plan", completedSteps: 5, totalSteps: 8 });
    expect(d).toEqual({ percent: 63, label: "63%", caption: "execution", detail: "5 of 8 steps", short: "63%" });
  });

  it("never passes context fill off as progress", () => {
    const d = displayProgress({ percent: 74, source: "context", completedSteps: null, totalSteps: null });
    expect(d).toEqual({ percent: null, label: "—", caption: "no plan", detail: null, short: "ctx 74%" });
  });

  it("labels status progress as complete", () => {
    expect(displayProgress({ percent: 100, source: "status", completedSteps: null, totalSteps: null }).caption)
      .toBe("complete");
  });

  it("renders unknown progress as a dash", () => {
    const d = displayProgress({ percent: null, source: "none", completedSteps: null, totalSteps: null });
    expect(d.label).toBe("—");
    expect(d.short).toBe("—");
    expect(d.percent).toBeNull();
    expect(d.caption).toBe("no estimate");
  });
});

describe("clampPercent / progressFraction", () => {
  it("clamps out-of-range and non-finite values", () => {
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(Number.NaN)).toBeNull();
  });
  it("returns a 0–1 fraction, empty when unknown or only context fill", () => {
    expect(progressFraction({ percent: 50, source: "plan", completedSteps: 1, totalSteps: 2 })).toBe(0.5);
    expect(progressFraction({ percent: 100, source: "status", completedSteps: null, totalSteps: null })).toBe(1);
    expect(progressFraction({ percent: 74, source: "context", completedSteps: null, totalSteps: null })).toBe(0);
    expect(progressFraction({ percent: null, source: "none", completedSteps: null, totalSteps: null })).toBe(0);
  });
});
