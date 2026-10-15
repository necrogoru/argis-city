import { computed, shallowRef } from "vue";
import { defineStore } from "pinia";
import type { TerminalInventoryEntry, TerminalTab } from "../domain/types";
import { aggregateTerminalRailEntries, type TerminalRailLiveStatusMap } from "../domain/terminalRail";
import type { TerminalStatus } from "../ui/Tasks/useTerminalSession";
import { useAgentSource } from "../composables/useAgentSource";
import { useTaskStore } from "./tasks";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useTerminalRailStore = defineStore("terminalRail", () => {
  const source = useAgentSource();
  const taskStore = useTaskStore();
  const inventory = shallowRef<TerminalInventoryEntry[]>([]);
  const liveStatuses = shallowRef<TerminalRailLiveStatusMap>({});
  const error = shallowRef<string | null>(null);

  const entries = computed(() => aggregateTerminalRailEntries(taskStore.tasks, inventory.value, liveStatuses.value));

  async function refreshInventory(): Promise<void> {
    try {
      inventory.value = await source.listTerminalInventory();
      error.value = null;
    } catch (reason) {
      error.value = errorMessage(reason);
    }
  }

  function publishTaskStatus(taskId: number, tab: TerminalTab, status: TerminalStatus): void {
    liveStatuses.value = {
      ...liveStatuses.value,
      [taskId]: {
        ...liveStatuses.value[taskId],
        [tab]: status,
      },
    };
  }

  function clearTaskStatus(taskId: number): void {
    const next = { ...liveStatuses.value };
    delete next[taskId];
    liveStatuses.value = next;
  }

  return { entries, error, refreshInventory, publishTaskStatus, clearTaskStatus };
});
