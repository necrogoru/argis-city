import { describe, expect, it } from "vitest";
import { BACKGROUND_FPS, FOCUSED_FPS, fpsLimitFor, frameDelayMs } from "./frameRate";

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

describe("frameDelayMs", () => {
  const vsync60 = 1000 / 60;

  it("30 fps waits just under two 60 Hz vsyncs, so the next frame lands on the second one", () => {
    expect(frameDelayMs(30)).toBeLessThan(2 * vsync60 - 1);
    expect(frameDelayMs(30)).toBeGreaterThan(vsync60 + 1);
  });

  it("15 fps waits just under four 60 Hz vsyncs", () => {
    expect(frameDelayMs(15)).toBeLessThan(4 * vsync60 - 1);
    expect(frameDelayMs(15)).toBeGreaterThan(3 * vsync60 + 1);
  });
});
