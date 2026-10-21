import type { Task, TaskGitStatus } from "./types";
import { isViewShortcutBlocked, type ShortcutTargetLike } from "./appViewShortcuts";
import { taskFocusDirectionForKey, type TaskFocusDirection } from "./taskFocus";

export type TaskBoardShortcutAction = "createTask" | "createBranch" | "openTerminal" | "changeStatus";
export type TaskBoardNavigationEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing" | "defaultPrevented"
>;

export type TaskBoardJumpShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export interface TaskBoardJumpResolution {
  taskId: number | null;
  pendingGAtMs: number | null;
}

export type TaskBoardShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

const DOUBLE_G_WINDOW_MS = 500;

/** Resolves Vim first/last motions while keeping their key sequence out of editors and dialogs. */
export function resolveTaskBoardJumpShortcut(
  event: TaskBoardJumpShortcutEvent,
  target: ShortcutTargetLike | null,
  visibleTaskIds: readonly number[],
  pendingGAtMs: number | null,
  nowMs: number,
  hasOpenDialog = false,
): TaskBoardJumpResolution {
  const clearSequence = { taskId: null, pendingGAtMs: null };
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    (event.shiftKey && event.key !== "G") ||
    isViewShortcutBlocked(target, hasOpenDialog)
  ) {
    return clearSequence;
  }

  if (event.key === "G") {
    return { taskId: visibleTaskIds.at(-1) ?? null, pendingGAtMs: null };
  }

  if (event.key !== "g" || event.shiftKey) return clearSequence;

  const isSecondG =
    pendingGAtMs !== null && nowMs >= pendingGAtMs && nowMs - pendingGAtMs <= DOUBLE_G_WINDOW_MS;
  if (isSecondG) return { taskId: visibleTaskIds[0] ?? null, pendingGAtMs: null };

  return { taskId: null, pendingGAtMs: nowMs };
}

/** Resolves an unmodified task-board shortcut after applying the shared text-entry and dialog guards. */
export function taskBoardActionForShortcut(
  event: TaskBoardShortcutEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog = false,
): TaskBoardShortcutAction | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  if (isViewShortcutBlocked(target, hasOpenDialog)) return null;

  switch (event.key.toLowerCase()) {
    case "c":
      return "createTask";
    case "b":
      return "createBranch";
    case "t":
      return "openTerminal";
    case "s":
      return "changeStatus";
    default:
      return null;
  }
}

/** Starts arrow/Vim-key task navigation outside cards without taking keys from inputs or dialogs. */
export function taskBoardNavigationDirection(
  event: TaskBoardNavigationEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog = false,
): TaskFocusDirection | null {
  if (event.defaultPrevented || event.isComposing || isViewShortcutBlocked(target, hasOpenDialog)) return null;
  return taskFocusDirectionForKey(event);
}

/** Returns the focused task only when it remains in the visible, filtered board results. */
export function focusedVisibleTask<T extends { id: number }>(
  focusedTaskId: number | null,
  visibleTaskIds: readonly number[],
  tasks: readonly T[],
): T | null {
  if (focusedTaskId == null || !visibleTaskIds.includes(focusedTaskId)) return null;
  return tasks.find((task) => task.id === focusedTaskId) ?? null;
}

/** Mirrors the disabled state of the board's New task button. */
export function canCreateTaskFromBoard(projectCount: number): boolean {
  return projectCount > 0;
}

/** Mirrors the branch action's Git-status and existing-branch checks on TaskCard. */
export function canCreateTaskBranch(
  task: Pick<Task, "branchName">,
  gitStatus: Pick<TaskGitStatus, "canCreateBranch"> | null,
): boolean {
  return Boolean(gitStatus?.canCreateBranch) && task.branchName === null;
}

/** Mirrors the terminal action's worktree and enabled-state checks on TaskCard. */
export function canOpenTaskTerminal(task: Pick<Task, "worktreePath">, enabled: boolean | undefined): boolean {
  return Boolean(enabled) && task.worktreePath !== null;
}
