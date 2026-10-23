import { onKeyStroke } from "@vueuse/core";
import { ref } from "vue";
import { appZoomActionFor, nextAppZoom, normalizeAppZoom } from "../domain/appZoom";
import { createAppZoom } from "../services/appZoom";
import { IS_MAC } from "./useModKey";

const STORAGE_KEY = "argis.appZoom";

function readStoredZoom(): number {
  if (typeof window === "undefined") return normalizeAppZoom(null);
  try {
    return normalizeAppZoom(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return normalizeAppZoom(null);
  }
}

function storeZoom(level: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    // Locked-down storage: the level still applies for this session.
  }
}

/**
 * Chrome-style app zoom: ⌘=/⌘−/⌘0 on macOS (Ctrl elsewhere) scales the whole
 * window, holding repeats, and the level survives restarts.
 */
export function useAppZoom(): void {
  const target = createAppZoom();
  const level = ref(readStoredZoom());

  function apply(next: number): void {
    level.value = next;
    storeZoom(next);
    void target.apply(next).catch((error: unknown) => {
      console.warn("argis: could not apply app zoom", error);
    });
  }

  apply(level.value);

  onKeyStroke((event) => {
    if (event.isComposing) return;
    const action = appZoomActionFor(event, IS_MAC);
    if (!action) return;
    event.preventDefault();
    apply(nextAppZoom(level.value, action));
  });
}
