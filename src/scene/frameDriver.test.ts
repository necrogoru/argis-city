import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameDriver } from "./frameDriver";

function setup(initialFps: number) {
  let fps = initialFps;
  const loop = { start: vi.fn(), stop: vi.fn() };
  const driver = createFrameDriver(loop, () => fps);
  return { loop, driver, setFps: (next: number) => (fps = next) };
}

describe("createFrameDriver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("parks the loop after a frame and restarts it when the next frame is due", async () => {
    const { loop, driver } = setup(30);
    driver.afterFrame();
    await Promise.resolve(); // the stop runs after the current animation-frame callback
    expect(loop.stop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(17); // past the first 60 Hz vsync: still parked
    expect(loop.start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16); // before the second vsync (33.3 ms): running again
    expect(loop.start).toHaveBeenCalledTimes(1);
  });

  it("keeps the loop running while the rate is unlimited (camera moving)", async () => {
    const { loop, driver } = setup(Infinity);
    driver.afterFrame();
    await Promise.resolve();
    vi.advanceTimersByTime(1000);
    expect(loop.stop).not.toHaveBeenCalled();
    expect(loop.start).not.toHaveBeenCalled();
  });

  it("restarts at once when the cap lifts, without a second start from the parked timer", async () => {
    const { loop, driver, setFps } = setup(15);
    driver.afterFrame();
    await Promise.resolve();
    setFps(Infinity);
    driver.rateChanged();
    expect(loop.start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(loop.start).toHaveBeenCalledTimes(1);
  });
});
