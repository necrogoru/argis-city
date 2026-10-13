import { defineStore } from "pinia";
import { ref } from "vue";

export type AppView = "city" | "tasks";

export const useAppViewStore = defineStore("appView", () => {
  const activeView = ref<AppView>("city");

  function showCity(): void {
    activeView.value = "city";
  }

  function showTasks(): void {
    activeView.value = "tasks";
  }

  return { activeView, showCity, showTasks };
});
