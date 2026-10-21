import type { AgentSession, Project, Task } from "../../domain/types";
import type { CommandAction } from "../../composables/useCommandActions";
import { compareSessions } from "../../domain/agentList";
import { scoreAction, scoreSession, scoreTask, tokenize } from "../../domain/search";
import type { PaletteOptionModel } from "./paletteOptionModel";

interface Candidate {
  option: PaletteOptionModel;
  score: number;
  order: number;
}

export function buildPaletteResults(
  sessions: readonly AgentSession[],
  tasks: readonly Task[],
  projects: readonly Project[],
  actions: readonly CommandAction[],
  query: string,
): PaletteOptionModel[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    const actionById = new Map(actions.map((action) => [action.id, action]));
    return ["view:tasks", "view:city", "create-task"].flatMap((id) => {
      const action = actionById.get(id);
      return action ? [{ key: `action:${action.id}`, kind: "action" as const, action }] : [];
    });
  }

  const projectPaths = new Map(projects.map((project) => [project.id, project.path]));
  const candidates: Candidate[] = [];
  let order = 0;
  const add = (option: PaletteOptionModel, score: number | null): void => {
    if (score != null) candidates.push({ option, score, order: order++ });
  };

  for (const session of [...sessions].sort(compareSessions)) {
    add({ key: `agent:${session.id}`, kind: "agent", session }, scoreSession(session, tokens));
  }

  for (const task of tasks) {
    const projectPath = projectPaths.get(task.projectId) ?? "";
    add(
      {
        key: `task:${task.id}`,
        kind: "task",
        task,
        projectPath: projectPath || "Unknown project",
      },
      scoreTask(task, projectPath, tokens),
    );
  }

  for (const action of actions) {
    add({ key: `action:${action.id}`, kind: "action", action }, scoreAction(action, tokens));
  }

  return candidates.sort((a, b) => b.score - a.score || a.order - b.order).map(({ option }) => option);
}
