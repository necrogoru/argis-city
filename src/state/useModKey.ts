import { useEffect, useLayoutEffect, useRef } from "react";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘" on macOS, "Ctrl" elsewhere — for shortcut hints. */
export const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl";
/** `aria-keyshortcuts` modifier name matching `MOD_KEY_LABEL`. */
export const MOD_KEY_ARIA = IS_MAC ? "Meta" : "Control";

/** Calls `handler` on ⌘+key (macOS) / Ctrl+key anywhere in the window (latest handler wins). */
export function useModKey(key: string, handler: () => void): void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = IS_MAC ? event.metaKey : event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey || event.key.toLowerCase() !== key) return;
      event.preventDefault();
      if (!event.repeat) latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key]);
}
