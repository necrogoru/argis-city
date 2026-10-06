import { createSharedComposable, useIntervalFn, useTimestamp } from "@vueuse/core";

/**
 * Current epoch ms, ticking every second — one timer shared by every caller.
 * The explicit interval scheduler matters: useTimestamp's default ticks on
 * every animation frame.
 */
export const useNow = createSharedComposable(() =>
  useTimestamp({ scheduler: (tick) => useIntervalFn(tick, 1_000) }),
);
