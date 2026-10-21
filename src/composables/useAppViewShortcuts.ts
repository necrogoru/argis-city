import { onKeyStroke } from "@vueuse/core";
import { resolveAppViewChord } from "../domain/appViewShortcuts";
import { useAppViewStore } from "../stores/appView";

export function useAppViewShortcuts(): void {
  const appView = useAppViewStore();
  let pendingGAtMs: number | null = null;

  onKeyStroke((event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const hasOpenDialog = document.querySelector("dialog[open]") !== null;
    const chord = resolveAppViewChord(event, target, hasOpenDialog, pendingGAtMs, Date.now());
    pendingGAtMs = chord.pendingGAtMs;
    if (chord.view === null) return;

    event.preventDefault();
    if (chord.view === "city") appView.showCity();
    else appView.showTasks();
  });
}
