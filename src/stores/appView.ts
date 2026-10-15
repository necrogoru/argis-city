import { defineStore } from "pinia";
import { ref } from "vue";

export type AppView = "city" | "tasks";

export const useAppViewStore = defineStore("appView", () => {
  const activeView = ref<AppView>("city");
  const createTaskRequested = ref(false);

  function showCity(): void {
    activeView.value = "city";
  }

  function showTasks(): void {
    activeView.value = "tasks";
  }

  function requestTaskCreation(): void {
    createTaskRequested.value = true;
    showTasks();
  }

  function consumeTaskCreationRequest(): boolean {
    if (!createTaskRequested.value) return false;
    createTaskRequested.value = false;
    return true;
  }

  return { activeView, createTaskRequested, showCity, showTasks, requestTaskCreation, consumeTaskCreationRequest };
});
