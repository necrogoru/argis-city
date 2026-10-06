import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type { Snapshot } from "../domain/types";
import { useAgentSource } from "../composables/useAgentSource";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Latest snapshot (null until the first one arrives), last error, and refresh.
 * The snapshot is replaced whole every poll, so it is a shallowRef: never
 * deep-proxied.
 */
export const useSnapshotStore = defineStore("snapshot", () => {
  const source = useAgentSource();
  const snapshot = shallowRef<Snapshot | null>(null);
  const error = ref<string | null>(null);

  /** Never let a late initial fetch overwrite a newer pushed snapshot. */
  function accept(next: Snapshot): void {
    if (snapshot.value && snapshot.value.generatedAt > next.generatedAt) return;
    snapshot.value = next;
    error.value = null;
  }

  source.subscribe(accept);
  source.getSnapshot().then(accept, (e: unknown) => {
    error.value = errorMessage(e);
  });

  /** Force the backend to collect now. */
  async function refresh(): Promise<void> {
    try {
      accept(await source.refresh());
    } catch (e) {
      error.value = errorMessage(e);
    }
  }

  return { snapshot, error, refresh };
});
