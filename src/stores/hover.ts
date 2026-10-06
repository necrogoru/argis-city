import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Which session is hovered — shared by the 3D houses and the agent list.
 * Consumers derive `hoveredId === id`, so a hover change re-renders only the
 * two components whose answer flips, not the whole city.
 */
export const useHoverStore = defineStore("hover", () => {
  const hoveredId = ref<string | null>(null);

  function set(id: string | null): void {
    hoveredId.value = id;
  }
  /** Clear only if `id` is still the hovered one (avoids leave/enter races). */
  function clear(id: string): void {
    if (hoveredId.value === id) hoveredId.value = null;
  }

  return { hoveredId, set, clear };
});
