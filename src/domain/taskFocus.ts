export type TaskFocusDirection = "down" | "up";

export function taskFocusDirectionForEvent(
  event: Pick<KeyboardEvent, "key" | "isComposing">,
  isWithinCard: boolean,
): TaskFocusDirection | null {
  if (!isWithinCard || event.isComposing) return null;
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp") return "up";
  return null;
}

/** Returns the next task ID in the current visible board order, wrapping at either end. */
export function nextVisibleTaskId(
  visibleTaskIds: readonly number[],
  focusedTaskId: number | null,
  direction: TaskFocusDirection,
): number | null {
  if (visibleTaskIds.length === 0) return null;

  const focusedIndex = focusedTaskId == null ? -1 : visibleTaskIds.indexOf(focusedTaskId);
  if (focusedIndex === -1) return direction === "down" ? visibleTaskIds[0] : visibleTaskIds[visibleTaskIds.length - 1];

  const step = direction === "down" ? 1 : -1;
  const nextIndex = (focusedIndex + step + visibleTaskIds.length) % visibleTaskIds.length;
  return visibleTaskIds[nextIndex];
}
