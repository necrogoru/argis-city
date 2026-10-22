import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import type { AgentStatus, ProviderId } from "../domain/types";
import { toggleFilter, type StatusFilter } from "../domain/agentList";
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
import { useAppViewStore } from "./appView";
import { useSnapshotStore } from "./snapshot";

/** What the user is looking at — one house and/or one focused district, and the list's status filter. */
export const useSelectionStore = defineStore("selection", () => {
  const appView = useAppViewStore();
  const snapshots = useSnapshotStore();
  const raw = shallowRef<Selection>(EMPTY_SELECTION);
  const houseCursorId = shallowRef<string | null>(null);
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
  function clearHouseCursor(): void {
    houseCursorId.value = null;
  }

  function setHouseCursor(sessionId: string | null): void {
    houseCursorId.value = sessionId;
  }

  watch(
    () => snapshots.snapshot,
    (snapshot) => {
      if (houseCursorId.value && snapshot && !snapshot.sessions.some((session) => session.id === houseCursorId.value)) {
        clearHouseCursor();
      }
    },
    { flush: "sync" },
  );
  watch(
    () => appView.activeView,
    (view) => {
      if (view !== "city") clearHouseCursor();
    },
    { flush: "sync" },
  );

  const selectedSession = computed(() => findSelected(snapshots.snapshot, selection.value.sessionId));
  const statusFilter = shallowRef<StatusFilter>(null);

  function selectSession(sessionId: string | null): void {
    clearHouseCursor();
    raw.value = withSession(selection.value, sessionId);
  }
  function clearSession(): void {
    clearHouseCursor();
    raw.value = withSession(selection.value, null);
  }
  function focusProvider(provider: ProviderId | null): void {
    clearHouseCursor();
    raw.value = withProvider(selection.value, provider);
  }
  function toggleProvider(provider: ProviderId): void {
    clearHouseCursor();
    raw.value = toggled(selection.value, provider);
  }
  function toggleStatusFilter(status: AgentStatus): void {
    statusFilter.value = toggleFilter(statusFilter.value, status);
  }
  function clearStatusFilter(): void {
    statusFilter.value = null;
  }
  /** The "Needs you" KPI: back to the Agents list, filtered to what waits on the user. */
  function showNeedsYou(): void {
    clearSession();
    statusFilter.value = "awaitingApproval";
  }
  /** Escape peels one layer: first the house, then the district focus. */
  function escape(): void {
    clearHouseCursor();
    raw.value = escapeSelection(selection.value);
  }

  // The ⌘K palette preventDefault()s its own Escape, so it never reaches here.
  onKeyStroke("Escape", (event) => {
    if (!event.defaultPrevented) escape();
  });

  return {
    selection,
    selectedSession,
    houseCursorId,
    statusFilter,
    setHouseCursor,
    clearHouseCursor,
    selectSession,
    clearSession,
    focusProvider,
    toggleProvider,
    toggleStatusFilter,
    clearStatusFilter,
    showNeedsYou,
    escape,
  };
});
