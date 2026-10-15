export type TaskFocusDirection = "left" | "down" | "up" | "right";
type TaskFocusKeyEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function taskFocusDirectionForKey(event: TaskFocusKeyEvent): TaskFocusDirection | null {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;

  switch (event.key.toLowerCase()) {
    case "arrowleft":
    case "h":
      return "left";
    case "arrowdown":
    case "j":
      return "down";
    case "arrowup":
    case "k":
      return "up";
    case "arrowright":
    case "l":
      return "right";
    default:
      return null;
  }
}

export function taskFocusDirectionForEvent(
  event: TaskFocusKeyEvent & Pick<KeyboardEvent, "isComposing">,
  isWithinCard: boolean,
): TaskFocusDirection | null {
  if (!isWithinCard || event.isComposing) return null;
  return taskFocusDirectionForKey(event);
}

/** Returns the next task ID in the current visible board order, wrapping at either end. */
export function nextVisibleTaskId(
  visibleTaskIds: readonly number[],
  focusedTaskId: number | null,
  direction: "down" | "up",
): number | null {
  if (visibleTaskIds.length === 0) return null;

  const focusedIndex = focusedTaskId == null ? -1 : visibleTaskIds.indexOf(focusedTaskId);
  if (focusedIndex === -1) return direction === "down" ? visibleTaskIds[0] : visibleTaskIds[visibleTaskIds.length - 1];

  const step = direction === "down" ? 1 : -1;
  const nextIndex = (focusedIndex + step + visibleTaskIds.length) % visibleTaskIds.length;
  return visibleTaskIds[nextIndex];
}

/** Moves to the adjacent visible task in the same column without wrapping. */
export function adjacentVerticalTaskId(
  visibleTaskColumns: readonly (readonly number[])[],
  focusedTaskId: number | null,
  direction: "down" | "up",
): number | null {
  if (focusedTaskId == null) return null;

  const column = visibleTaskColumns.find((taskIds) => taskIds.includes(focusedTaskId));
  if (!column) return null;

  const rowIndex = column.indexOf(focusedTaskId);
  const nextRowIndex = rowIndex + (direction === "down" ? 1 : -1);
  return column[nextRowIndex] ?? null;
}

/** Moves to the nearest populated column, preserving the focused row when possible. */
export function adjacentVisibleTaskId(
  visibleTaskColumns: readonly (readonly number[])[],
  focusedTaskId: number | null,
  direction: "left" | "right",
): number | null {
  if (focusedTaskId == null) return null;

  const columnIndex = visibleTaskColumns.findIndex((column) => column.includes(focusedTaskId));
  if (columnIndex === -1) return null;

  const rowIndex = visibleTaskColumns[columnIndex].indexOf(focusedTaskId);
  const step = direction === "right" ? 1 : -1;

  for (let targetIndex = columnIndex + step; targetIndex >= 0 && targetIndex < visibleTaskColumns.length; targetIndex += step) {
    const targetColumn = visibleTaskColumns[targetIndex];
    if (targetColumn.length > 0) return targetColumn[Math.min(rowIndex, targetColumn.length - 1)];
  }

  return null;
}
