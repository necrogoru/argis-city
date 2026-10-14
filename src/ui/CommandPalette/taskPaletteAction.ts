import type { Task } from "../../domain/types";

export type TaskPaletteAction = "open-terminal" | "open-tasks";

export function taskPaletteAction(task: Task): TaskPaletteAction {
  return task.worktreePath ? "open-terminal" : "open-tasks";
}
