import { onKeyStroke } from "@vueuse/core";
import { appViewForShortcut, isViewShortcutBlocked } from "../domain/appViewShortcuts";
import { useAppViewStore } from "../stores/appView";
import { IS_MAC } from "./useModKey";

export function useAppViewShortcuts(): void {
  const appView = useAppViewStore();

  onKeyStroke(
    (event) => appViewForShortcut(event, IS_MAC) !== null,
    (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const hasOpenDialog = document.querySelector("dialog[open]") !== null;
      if (isViewShortcutBlocked(target, hasOpenDialog)) return;

      const view = appViewForShortcut(event, IS_MAC);
      if (view === null) return;
      event.preventDefault();
      if (view === "city") appView.showCity();
      else appView.showTasks();
    },
  );
}
