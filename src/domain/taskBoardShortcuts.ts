import type { Task, TaskGitStatus } from "./types";
import { isViewShortcutBlocked, type ShortcutTargetLike } from "./appViewShortcuts";
import type { TaskFocusDirection } from "./taskFocus";

export type TaskBoardShortcutAction = "createTask" | "createBranch" | "openTerminal";
export type TaskBoardNavigationEvent = Pick<KeyboardEvent, "key" | "isComposing" | "defaultPrevented">;

export type TaskBoardShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing"
>;

/** Resolves an unmodified task-board shortcut after applying the shared text-entry and dialog guards. */
export function taskBoardActionForShortcut(
  event: TaskBoardShortcutEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog = false,
): TaskBoardShortcutAction | null {
  if (event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  if (isViewShortcutBlocked(target, hasOpenDialog)) return null;

  switch (event.key.toLowerCase()) {
    case "c":
      return "createTask";
    case "b":
      return "createBranch";
    case "t":
      return "openTerminal";
    default:
      return null;
  }
}

/** Starts arrow-key task navigation outside cards without taking keys from inputs or dialogs. */
export function taskBoardNavigationDirection(
  event: TaskBoardNavigationEvent,
  target: ShortcutTargetLike | null,
  hasOpenDialog = false,
): TaskFocusDirection | null {
  if (event.defaultPrevented || event.isComposing || isViewShortcutBlocked(target, hasOpenDialog)) return null;
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp") return "up";
  return null;
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
