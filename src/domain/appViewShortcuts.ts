export type AppViewShortcutTarget = "city" | "tasks";

export type AppViewChordEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export interface ShortcutTargetLike {
  tagName: string;
  isContentEditable: boolean;
  closest: (selector: string) => unknown;
}

export interface AppViewChordResolution {
  view: AppViewShortcutTarget | null;
  pendingGAtMs: number | null;
}

export const APP_VIEW_CHORD_WINDOW_MS = 500;

/**
 * Resolves Vim-style `g d` / `g t` view chords. The first `g` is left unconsumed
 * so the task board can still build its own `gg` sequence.
 */
export function resolveAppViewChord(
  event: AppViewChordEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog: boolean,
  pendingGAtMs: number | null,
  nowMs: number,
): AppViewChordResolution {
  const clearSequence = { view: null, pendingGAtMs: null };

  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    isViewShortcutBlocked(target, hasOpenDialog)
  ) {
    return clearSequence;
  }

  if (event.key === "g") return { view: null, pendingGAtMs: nowMs };

  if (event.key !== "d" && event.key !== "t") return clearSequence;

  const isChord =
    pendingGAtMs !== null &&
    nowMs >= pendingGAtMs &&
    nowMs - pendingGAtMs <= APP_VIEW_CHORD_WINDOW_MS;
  if (!isChord) return clearSequence;

  return { view: event.key === "d" ? "city" : "tasks", pendingGAtMs: null };
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
