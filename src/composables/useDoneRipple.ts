import { ref, watch, type Ref } from "vue";
import type { AgentStatus } from "../domain/types";
import { justFinished } from "../domain/houseVisuals";

/**
 * Increments each time `status` transitions into "done" (never on mount), so a
 * keyed one-shot ripple can replay.
 */
export function useDoneRipple(status: () => AgentStatus): Readonly<Ref<number>> {
  const ripples = ref(0);
  watch(status, (next, previous) => {
    if (justFinished(previous ?? null, next)) ripples.value += 1;
  });
  return ripples;
}
