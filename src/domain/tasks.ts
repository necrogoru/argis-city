import type { Task, TaskStatus } from "./types";

export const TASK_STATUS_ORDER: readonly TaskStatus[] = ["pending", "inProgress", "stopped", "canceled", "completed"];

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
