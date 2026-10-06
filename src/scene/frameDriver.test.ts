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
  it("wakes a parked loop at once, and parks it again after the next frame", async () => {
    const { loop, driver } = setup(30);
    driver.afterFrame();
    await Promise.resolve();
    driver.wake(); // e.g. a pointer event on the canvas
    expect(loop.start).toHaveBeenCalledTimes(1);
    driver.wake(); // already running: no second start
    expect(loop.start).toHaveBeenCalledTimes(1);
    driver.afterFrame();
    await Promise.resolve();
    expect(loop.stop).toHaveBeenCalledTimes(2);
  });

  it("renders at once when the rate rises (focus regained), not when the slow timer fires", async () => {
    const { loop, driver, setFps } = setup(15);
    driver.afterFrame();
    await Promise.resolve();
    setFps(30);
    driver.rateChanged();
    expect(loop.start).toHaveBeenCalledTimes(1);
  });

  it("never leaves the loop parked once disposed, so a remounted driver is not stuck", async () => {
    const parkedThenDisposed = setup(30);
    parkedThenDisposed.driver.afterFrame();
    await Promise.resolve();
    parkedThenDisposed.driver.dispose();
    expect(parkedThenDisposed.loop.start).toHaveBeenCalledTimes(1);

    const disposedBeforeParking = setup(30);
    disposedBeforeParking.driver.afterFrame();
    disposedBeforeParking.driver.dispose(); // before the deferred stop runs
    await Promise.resolve();
    expect(disposedBeforeParking.loop.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(disposedBeforeParking.loop.start).not.toHaveBeenCalled();
  });
  it("a wake between a frame and its deferred park keeps the loop running instead of stranding it", async () => {
    const { loop, driver } = setup(30);
    driver.afterFrame();
    driver.wake(); // a Vue watcher flushing in the same microtask queue as the park
    await Promise.resolve();
    expect(loop.stop).not.toHaveBeenCalled();
    driver.afterFrame(); // the frame the wake asked for
    await Promise.resolve();
    expect(loop.stop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(33);
    expect(loop.start).toHaveBeenCalledTimes(1);
  });
});
