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
  let refreshPromise: Promise<void> | null = null;

  const entries = computed(() => aggregateTerminalRailEntries(
    taskStore.tasks,
    inventory.value,
    liveStatuses.value,
    taskStore.taskAgentResumes,
  ));

  async function refreshInventory(): Promise<void> {
    try {
      const previousStates = new Map(
        inventory.value.map((entry) => [`${entry.taskId}:${entry.tab}`, entry.state]),
      );
      const nextInventory = await source.listTerminalInventory();
      const completedSessionAppeared = nextInventory.some(
        (entry) => (entry.state === "completed" || entry.state === "failed") &&
          previousStates.get(`${entry.taskId}:${entry.tab}`) !== entry.state,
      );
      inventory.value = nextInventory;
      error.value = null;
      if (completedSessionAppeared) {
        try {
          await taskStore.refreshTaskAgentResumes();
        } catch (reason) {
          error.value = errorMessage(reason);
        }
      }
    } catch (reason) {
      error.value = errorMessage(reason);
    }
  }

  function refreshAll(): Promise<void> {
    if (refreshPromise) return refreshPromise;

    const promise = taskStore
      .ensureSearchDataLoaded()
      .then(() => refreshInventory())
      .finally(() => {
        if (refreshPromise === promise) refreshPromise = null;
      });
    refreshPromise = promise;
    return promise;
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

  function clearTaskTabStatus(taskId: number, tab: TerminalTab): void {
    const taskStatuses = liveStatuses.value[taskId];
    if (!taskStatuses || !(tab in taskStatuses)) return;
    const nextStatuses = { ...taskStatuses };
    delete nextStatuses[tab];
    const next = { ...liveStatuses.value };
    if (Object.keys(nextStatuses).length === 0) delete next[taskId];
    else next[taskId] = nextStatuses;
    liveStatuses.value = next;
  }

  function clearTaskStatus(taskId: number): void {
    const next = { ...liveStatuses.value };
    delete next[taskId];
    liveStatuses.value = next;
  }

  return { entries, error, refreshInventory, refreshAll, publishTaskStatus, clearTaskTabStatus, clearTaskStatus };
});
