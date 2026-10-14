import { defineStore } from "pinia";
import { ref } from "vue";

export const useTerminalNavigationStore = defineStore("terminalNavigation", () => {
  const taskId = ref<number | null>(null);
  const open = ref(false);

  function openTaskTerminal(id: number): void {
    taskId.value = id;
    open.value = true;
  }

  function closeTerminal(): void {
    open.value = false;
  }

  function clearTaskTerminal(id: number): void {
    if (taskId.value !== id) return;
    taskId.value = null;
    open.value = false;
  }

  return { taskId, open, openTaskTerminal, closeTerminal, clearTaskTerminal };
});
