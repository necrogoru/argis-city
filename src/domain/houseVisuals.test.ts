import { describe, expect, it } from "vitest";
import type { AgentStatus } from "./types";
import { PALETTE } from "./palette";
import {
  animationLevel,
  BLINK_PERIOD_S,
  BLOOM_THRESHOLD,
  BREATHE_PERIOD_S,
  emissiveAt,
  houseVisual,
  justFinished,
  ringPulse,
} from "./houseVisuals";

const ALL: AgentStatus[] = ["running", "awaitingApproval", "idle", "done", "error"];
const times = Array.from({ length: 400 }, (_, i) => i * 0.037);

describe("houseVisual", () => {
  it("running keeps the provider colour, shimmers and emits sparks", () => {
    expect(houseVisual("running", "codex")).toMatchObject({
      hex: PALETTE.blue, animation: "shimmer", beacon: "sparks", lineFlow: true,
    });
    expect(houseVisual("running", "pi").hex).toBe(PALETTE.violet);
  });

  it("awaiting approval is amber, blinks, has a beacon and a ground pulse", () => {
    const v = houseVisual("awaitingApproval", "claude");
    expect(v).toMatchObject({ hex: "#FFB662", animation: "blink", beacon: "alert", groundPulse: true });
    expect(v.intensity[1]).toBe(Math.max(...ALL.map((s) => houseVisual(s, "claude").intensity[1])));
  });

  it("idle is grey, breathes, has few lit windows and stays under the bloom threshold", () => {
    const v = houseVisual("idle", "claude");
    expect(v).toMatchObject({ hex: "#8E9794", animation: "breathe", litWindows: "few", beacon: null });
    expect(v.intensity[1]).toBeLessThan(BLOOM_THRESHOLD);
    expect(v.labelOpacity).toBeLessThan(1);
  });

  it("done is steady blue with a halo; error is red, flickers and darkens the body", () => {
    expect(houseVisual("done", "opencode")).toMatchObject({ hex: "#67A2FD", animation: "steady", beacon: "halo" });
    const error = houseVisual("error", "opencode");
    expect(error).toMatchObject({ hex: "#FF6B6B", animation: "flicker" });
    expect(error.bodyHex).not.toBe(houseVisual("running", "opencode").bodyHex);
  });
});

describe("emissiveAt / animationLevel", () => {
  it("stays within each status's intensity range", () => {
    for (const status of ALL) {
      const v = houseVisual(status, "claude");
      for (const t of times) {
        const e = emissiveAt(v, t, 1.3);
        expect(e).toBeGreaterThanOrEqual(v.intensity[0] - 1e-9);
        expect(e).toBeLessThanOrEqual(v.intensity[1] + 1e-9);
      }
    }
  });

  it("blinks with a ~1.2 s period and breathes with a 4–5 s period", () => {
    expect(BLINK_PERIOD_S).toBeCloseTo(1.2);
    expect(BREATHE_PERIOD_S).toBeGreaterThanOrEqual(4);
    expect(BREATHE_PERIOD_S).toBeLessThanOrEqual(5);
    for (const t of [0.1, 0.5, 0.9]) {
      expect(animationLevel("blink", t)).toBeCloseTo(animationLevel("blink", t + BLINK_PERIOD_S));
      expect(animationLevel("breathe", t, 2)).toBeCloseTo(animationLevel("breathe", t + BREATHE_PERIOD_S, 2));
    }
  });

  it("offsets the shimmer per house so a district doesn't pulse in sync", () => {
    expect(animationLevel("shimmer", 1, 0)).not.toBeCloseTo(animationLevel("shimmer", 1, 2.5));
  });

  it("flickers irregularly but deterministically, with occasional dips", () => {
    const a = times.map((t) => animationLevel("flicker", t, 0.4));
    const b = times.map((t) => animationLevel("flicker", t, 0.4));
    expect(a).toEqual(b);
    expect(a.some((v) => v < 0.1)).toBe(true);
    expect(a.filter((v) => v > 0.8).length).toBeGreaterThan(a.length / 2);
  });
});

describe("ringPulse / justFinished", () => {
  it("grows and fades out over its progress", () => {
    expect(ringPulse(0)).toEqual({ scale: 1, opacity: 1 });
    expect(ringPulse(0.5).scale).toBeGreaterThan(1);
    expect(ringPulse(1).opacity).toBe(0);
    expect(ringPulse(2)).toEqual(ringPulse(1));
  });

  it("only fires on a transition into done", () => {
    expect(justFinished("running", "done")).toBe(true);
    expect(justFinished(null, "done")).toBe(false);
    expect(justFinished("done", "done")).toBe(false);
    expect(justFinished("done", "idle")).toBe(false);
  });
});
