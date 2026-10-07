import { describe, expect, it } from "vitest";
import iconSvg from "../../../src-tauri/icons/app-icon.svg?raw";
import { MARK_CENTER, MARK_DOTS, PUPIL_RADIUS } from "./panoptesMark";

/** The grid dots drawn in the app icon: every circle except the glow and the pupil. */
function iconDots(): string[] {
  return [...iconSvg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="(#[0-9A-Fa-f]{6})"/g)]
    .filter(([, , , r]) => Number(r) < PUPIL_RADIUS)
    .map(([, x, y, r, fill]) => `${x},${y},${r},${fill.toUpperCase()}`);
}

describe("MARK_DOTS", () => {
  it("draws the same dots as the app icon", () => {
    const mark = MARK_DOTS.map((d) => `${d.x},${d.y},${d.r},${d.fill}`);
    expect(mark).toHaveLength(96);
    expect(new Set(mark)).toEqual(new Set(iconDots()));
  });

  it("is symmetric about the pupil", () => {
    const key = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const at = new Set(MARK_DOTS.map((d) => key(d.x, d.y)));
    for (const d of MARK_DOTS) expect(at.has(key(2 * MARK_CENTER - d.x, 2 * MARK_CENTER - d.y))).toBe(true);
  });

  it("wakes a handful of agents among the white dots only", () => {
    const agents = MARK_DOTS.filter((d) => d.agent);
    expect(agents).toHaveLength(6);
    expect(agents.every((d) => d.fill === "#E4ECEE")).toBe(true);
  });
});
