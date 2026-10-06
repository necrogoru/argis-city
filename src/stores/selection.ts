import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import type { ProviderId } from "../domain/types";
import {
  EMPTY_SELECTION,
  escapeSelection,
  reconcileSelection,
  toggleProvider as toggled,
  withProvider,
  withSession,
  type Selection,
} from "../domain/selection";
import { findSelected } from "../domain/session";
import { useSnapshotStore } from "./snapshot";

/** What the user is looking at — one house and/or one focused district. */
export const useSelectionStore = defineStore("selection", () => {
  const snapshots = useSnapshotStore();
  const raw = shallowRef<Selection>(EMPTY_SELECTION);
  const selection = computed(() =>
    snapshots.snapshot ? reconcileSelection(raw.value, snapshots.snapshot) : raw.value,
  );
  // Persist the reconciliation so a vanished session never silently comes back.
  watch(
    selection,
    (next) => {
      if (next !== raw.value) raw.value = next;
    },
    { flush: "sync" },
  );
  const selectedSession = computed(() => findSelected(snapshots.snapshot, selection.value.sessionId));

  function selectSession(sessionId: string | null): void {
    raw.value = withSession(selection.value, sessionId);
  }
  function clearSession(): void {
    raw.value = withSession(selection.value, null);
  }
  function focusProvider(provider: ProviderId | null): void {
    raw.value = withProvider(selection.value, provider);
  }
  function toggleProvider(provider: ProviderId): void {
    raw.value = toggled(selection.value, provider);
  }
  /** Escape peels one layer: first the house, then the district focus. */
  function escape(): void {
    raw.value = escapeSelection(selection.value);
  }

  // The ⌘K palette preventDefault()s its own Escape, so it never reaches here.
  onKeyStroke("Escape", (event) => {
    if (!event.defaultPrevented) escape();
  });

  return { selection, selectedSession, selectSession, clearSession, focusProvider, toggleProvider, escape };
});
