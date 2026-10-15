import type { Project, Task } from "./types";

/**
 * Filters board tasks by text and project while preserving their input order.
 * The project name is the final path segment, matching the board's project label.
 */
export function searchBoardTasks(
  tasks: readonly Task[],
  projects: readonly Project[],
  query: string,
  projectId: number | null = null,
): Task[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const projectInfo = new Map(
    projects.map((project) => [
      project.id,
      {
        name: project.path.split(/[\\/]/).filter(Boolean).pop() ?? "",
        path: project.path,
      },
    ]),
  );

  return tasks.filter((task) => {
    if (projectId != null && task.projectId !== projectId) return false;
    if (tokens.length === 0) return true;

    const project = projectInfo.get(task.projectId);
    const fields = [
      String(task.id),
      `#${task.id}`,
      task.title,
      task.description,
      project?.name ?? "",
      project?.path ?? "",
    ].map((field) => field.toLowerCase());

    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}
