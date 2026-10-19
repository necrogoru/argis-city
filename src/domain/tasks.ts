import type { Task, TaskStatus } from "./types";

type TaskStatusShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export const TASK_STATUS_ORDER: readonly TaskStatus[] = ["pending", "inProgress", "stopped", "canceled", "completed"];

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  pending: "Pending",
  inProgress: "In progress",
  stopped: "Stopped",
  canceled: "Canceled",
  completed: "Completed",
};

export interface TaskGroups {
  pending: Task[];
  inProgress: Task[];
  other: Task[];
}

export function previousTaskStatus(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_ORDER.indexOf(status);
  return index > 0 ? TASK_STATUS_ORDER[index - 1] : null;
}

export function nextTaskStatus(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_ORDER.indexOf(status);
  return index >= 0 && index < TASK_STATUS_ORDER.length - 1 ? TASK_STATUS_ORDER[index + 1] : null;
}

export function taskStatusForShortcut(event: TaskStatusShortcutEvent): TaskStatus | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    !/^[1-5]$/.test(event.key)
  ) {
    return null;
  }

  return TASK_STATUS_ORDER[Number(event.key) - 1] ?? null;
}

export function groupTasks(tasks: readonly Task[], projectId: number | null = null): TaskGroups {
  const groups: TaskGroups = { pending: [], inProgress: [], other: [] };

  for (const task of tasks) {
    if (projectId != null && task.projectId !== projectId) continue;
    if (task.status === "pending") groups.pending.push(task);
    else if (task.status === "inProgress") groups.inProgress.push(task);
    else groups.other.push(task);
  }

  return groups;
}

export function taskBranchName(taskId: number, title: string): string {
  return `argis/${taskId}-${taskTitleSlug(title)}`;
}

export function taskWorktreePath(projectPath: string, taskId: number, title: string): string {
  const project = projectPath.replace(/[\\/]+$/, "");
  return `${project}/.argis/worktrees/${taskId}-${taskTitleSlug(title)}`;
}

function taskTitleSlug(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  return slug || "task";
}
