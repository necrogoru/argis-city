import { describe, expect, it } from "vitest";
import { BACKGROUND_FPS, FOCUSED_FPS, fpsLimitFor, rafFpsLimit } from "./frameRate";

describe("fpsLimitFor", () => {
  it("caps ambient animation at 30 fps while the window is focused", () => {
    expect(fpsLimitFor({ moving: false, focused: true })).toBe(FOCUSED_FPS);
    expect(FOCUSED_FPS).toBe(30);
  });

  it("drops to 15 fps when the window is unfocused", () => {
    expect(fpsLimitFor({ moving: false, focused: false })).toBe(BACKGROUND_FPS);
    expect(BACKGROUND_FPS).toBe(15);
  });

  it("is unlimited while the camera moves — moving wins over focus", () => {
    expect(fpsLimitFor({ moving: true, focused: true })).toBe(Infinity);
    expect(fpsLimitFor({ moving: true, focused: false })).toBe(Infinity);
  });
});

describe("rafFpsLimit", () => {
  /** Shortest frame interval TresJS's rAF loop accepts for a given target rate. */
  const minInterval = (fps: number) => 1000 / rafFpsLimit(fps);
  const vsync60 = 1000 / 60;

  it("30 fps renders every second 60 Hz vsync even when it arrives 1 ms early", () => {
    expect(minInterval(30)).toBeLessThan(2 * vsync60 - 1);
    expect(minInterval(30)).toBeGreaterThan(vsync60 + 1);
  });

  it("15 fps renders every fourth 60 Hz vsync even when it arrives 1 ms early", () => {
    expect(minInterval(15)).toBeLessThan(4 * vsync60 - 1);
    expect(minInterval(15)).toBeGreaterThan(3 * vsync60 + 1);
  });

  it("leaves an unlimited rate unlimited", () => {
    expect(rafFpsLimit(Infinity)).toBe(Infinity);
  });
});
