import type { TerminalTab } from "./types";

/** Task terminals open on the shell so they behave like a normal terminal. */
export const DEFAULT_TERMINAL_TAB: TerminalTab = "term";

type TerminalNavigationKey = Pick<KeyboardEvent, "key" | "ctrlKey">
  & Partial<Pick<KeyboardEvent, "altKey" | "metaKey">>;

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
  activeTab: TerminalTab,
  event: TerminalNavigationKey,
): TerminalTab | null {
  if (event.key === "Tab" && event.ctrlKey && !event.altKey && !event.metaKey) {
    return activeTab === "agent" ? "term" : "agent";
  }

  if (event.key === "Home") return "agent";
  if (event.key === "End") return "term";
  if (event.key === "ArrowLeft" && activeTab === "term") return "agent";
  if (event.key === "ArrowRight" && activeTab === "agent") return "term";
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") return activeTab;
  return null;
}
