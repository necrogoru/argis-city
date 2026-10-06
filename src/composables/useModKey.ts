import { onKeyStroke } from "@vueuse/core";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘" on macOS, "Ctrl" elsewhere — for shortcut hints. */
export const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl";
/** `aria-keyshortcuts` modifier name matching `MOD_KEY_LABEL`. */
export const MOD_KEY_ARIA = IS_MAC ? "Meta" : "Control";

type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** ⌘+key on macOS / Ctrl+key elsewhere, without Alt or Shift. */
export function isModKey(event: KeyLike, key: string, mac = IS_MAC): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  return mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === key;
}

/** Calls `handler` on ⌘/Ctrl+`key` anywhere in the window (key repeats ignored). */
export function useModKey(key: string, handler: () => void): void {
  onKeyStroke(
    (event) => isModKey(event, key),
    (event) => {
      event.preventDefault();
      if (!event.repeat) handler();
    },
  );
}
