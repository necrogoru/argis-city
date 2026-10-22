import { isViewShortcutBlocked, type ShortcutTargetLike } from "./appViewShortcuts";
import type { HouseCursorDirection } from "./houseNavigation";

export type HouseNavigationKeyEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export type HouseNavigationKeyAction = { type: "move"; direction: HouseCursorDirection } | { type: "commit" };

const NON_SHORTCUT_CONTROLS = "button, a, [role='button'], [role='tab'], [role='menuitem'], summary, [tabindex]:not([tabindex='-1']), .rail";

export function resolveHouseNavigationKeyAction(
  event: HouseNavigationKeyEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog: boolean,
): HouseNavigationKeyAction | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    isViewShortcutBlocked(target, hasOpenDialog) ||
    target?.closest(NON_SHORTCUT_CONTROLS)
  ) {
    return null;
  }

  if (event.key === "h" || event.key === "ArrowLeft") return { type: "move", direction: "previous" };
  if (event.key === "l" || event.key === "ArrowRight") return { type: "move", direction: "next" };
  if (event.key === "Enter") return { type: "commit" };
  return null;
}
