export type AppViewShortcutTarget = "city" | "tasks";

export type AppViewShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing"
>;

export interface ShortcutTargetLike {
  tagName: string;
  isContentEditable: boolean;
  closest: (selector: string) => unknown;
}

export function appViewForShortcut(event: AppViewShortcutEvent, mac: boolean): AppViewShortcutTarget | null {
  if (event.repeat || event.isComposing || event.altKey || event.shiftKey) return null;
  if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
  return null;
}

/** Keep app navigation shortcuts out of text entry, modal dialogs, and xterm input. */
export function isViewShortcutBlocked(target: ShortcutTargetLike | null, hasOpenDialog = false): boolean {
  if (hasOpenDialog) return true;
  if (!target) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    target.closest(".xterm-helper-textarea") !== null
  );
}
