import type { TerminalTab } from "./types";

/** Task terminals open on the shell so they behave like a normal terminal. */
export const DEFAULT_TERMINAL_TAB: TerminalTab = "term";

type TerminalNavigationKey = Pick<KeyboardEvent, "key" | "ctrlKey">
  & Partial<Pick<KeyboardEvent, "altKey" | "metaKey" | "shiftKey">>;

type TerminalStartShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

type TerminalCloseShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export function shouldCloseTerminalModalForKey(
  event: TerminalCloseShortcutEvent,
  terminalInputFocused: boolean,
): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;

  if (event.key === "Escape") {
    if (event.metaKey || event.altKey || event.shiftKey) return false;
    if (event.ctrlKey) return true;
    return !terminalInputFocused;
  }

  return false;
}

export function shouldStartTerminalForKey(event: TerminalStartShortcutEvent, canStart: boolean): boolean {
  return (
    canStart &&
    event.key.toLowerCase() === "s" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    !event.isComposing &&
    !event.defaultPrevented
  );
}

export function getTerminalTabForKey(
  tabs: readonly TerminalTab[],
  activeTab: TerminalTab,
  event: TerminalNavigationKey,
): TerminalTab | null {
  const index = tabs.indexOf(activeTab);
  if (index < 0) return null;

  if (event.key === "Tab" && event.ctrlKey && !event.altKey && !event.metaKey) {
    const step = event.shiftKey ? -1 : 1;
    return tabs[(index + step + tabs.length) % tabs.length] ?? null;
  }

  if (event.key === "Home") return tabs[0] ?? null;
  if (event.key === "End") return tabs[tabs.length - 1] ?? null;
  if (event.key === "ArrowLeft") return tabs[Math.max(index - 1, 0)] ?? null;
  if (event.key === "ArrowRight") return tabs[Math.min(index + 1, tabs.length - 1)] ?? null;
  return null;
}
