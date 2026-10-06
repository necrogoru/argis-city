import { createSharedComposable, useTimestamp } from "@vueuse/core";

/** Current epoch ms, ticking every second — one timer shared by every caller. */
export const useNow = createSharedComposable(() => useTimestamp({ interval: 1_000 }));
