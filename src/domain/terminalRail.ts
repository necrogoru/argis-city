import type { ProviderId, Task, TaskAgentResume, TerminalInventoryEntry, TerminalInventoryState, TerminalTab } from "./types";
import type { TerminalStatus } from "../ui/Tasks/useTerminalSession";
import { taskFocusDirectionForKey } from "./taskFocus";
import { PROVIDERS } from "./providers";

export type TerminalRailState = "idle" | "pending" | "running" | "completed" | "resumable" | "unavailable";

export interface TerminalRailEntry {
  taskId: number;
  index: number;
  title: string;
  state: TerminalRailState;
  resumeProvider: ProviderId | null;
}

export type TerminalRailLiveStatusMap = Record<number, Partial<Record<TerminalTab, TerminalStatus>>>;

function inventoryStateRank(state: TerminalInventoryState): number {
  switch (state) {
    case "running": return 3;
    case "completed": return 1;
    case "failed": return 2;
  }
}

function reduceInventory(states: TerminalInventoryState[]): TerminalRailState | null {
  if (states.length === 0) return null;
  if (states.some((state) => state === "running")) return "running";
  if (states.some((state) => state === "failed")) return "unavailable";
  if (states.some((state) => state === "completed")) return "completed";
  return null;
}

function reduceLiveStatuses(statuses: TerminalStatus[]): TerminalRailState | null {
  if (statuses.some((status) => status === "running")) return "running";
  if (statuses.some((status) => status === "starting")) return "pending";
  if (statuses.some((status) => status === "error")) return "unavailable";
  if (statuses.some((status) => status === "exited")) return "completed";
  return null;
}

function aggregateTaskState(
  inventoryStates: TerminalInventoryState[],
  liveStatuses: TerminalStatus[],
): TerminalRailState {
  const liveState = reduceLiveStatuses(liveStatuses);
  if (liveState === "running") return "running";
  if (liveState === "pending") return "pending";
  if (liveState === "unavailable") return "unavailable";
  if (liveState === "completed") return "completed";

  return reduceInventory(inventoryStates) ?? "idle";
}

export function aggregateTerminalRailEntries(
  tasks: Task[],
  inventory: TerminalInventoryEntry[],
  liveStatuses: TerminalRailLiveStatusMap,
  resumes: TaskAgentResume[] = [],
): TerminalRailEntry[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const resumeByTaskId = new Map(resumes.map((resume) => [resume.taskId, resume]));
  const orderedTaskIds = [
    ...tasks.map((task) => task.id),
    ...inventory
      .map((entry) => entry.taskId)
      .filter((taskId) => !taskById.has(taskId)),
  ];

  return orderedTaskIds.flatMap((taskId, index) => {
    const task = taskById.get(taskId);
    if (!task) return [];
    const inventoryStates = inventory
      .filter((entry) => entry.taskId === taskId)
      .sort((left, right) => inventoryStateRank(right.state) - inventoryStateRank(left.state))
      .map((entry) => entry.state);
    const liveState = liveStatuses[taskId];
    const statuses = [liveState?.agent, liveState?.term].filter((value): value is TerminalStatus => value != null);
    const resume = resumeByTaskId.get(taskId);
    const terminalState = aggregateTaskState(inventoryStates, statuses);
    const hasLiveProcess = terminalState === "running" || terminalState === "pending";
    return [{
      taskId,
      index: index + 1,
      title: task.title,
      state: !hasLiveProcess && resume ? "resumable" : terminalState,
      resumeProvider: resume?.provider ?? null,
    }];
  });
}

export function filterInProgressTerminalRailEntries(
  entries: readonly TerminalRailEntry[],
  tasks: readonly Task[],
): TerminalRailEntry[] {
  const inProgressTaskIds = new Set(tasks.filter((task) => task.status === "inProgress").map((task) => task.id));
  return entries.filter((entry) => inProgressTaskIds.has(entry.taskId));
}

export function terminalRailTitlePreview(title: string): string {
  return Array.from(title).slice(0, 10).join("");
}

export type TerminalRailNavigationDirection = "down" | "up";
export type TerminalRailKeyEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export function terminalRailNavigationDirection(
  event: TerminalRailKeyEvent,
  isLauncherFocused: boolean,
): TerminalRailNavigationDirection | null {
  if (!isLauncherFocused || event.isComposing || event.defaultPrevented) return null;
  if (event.repeat && ["j", "k"].includes(event.key.toLowerCase())) return null;

  const direction = taskFocusDirectionForKey(event);
  return direction === "down" || direction === "up" ? direction : null;
}

export function terminalRailStateLabel(state: TerminalRailState): string {
  switch (state) {
    case "idle": return "Idle";
    case "pending": return "Pending";
    case "running": return "Running";
    case "completed": return "Completed";
    case "resumable": return "Resumable";
    case "unavailable": return "Unavailable";
  }
}

export function terminalRailEntryLabel(entry: TerminalRailEntry): string {
  if (entry.state === "resumable" && entry.resumeProvider) {
    return `Resume ${PROVIDERS[entry.resumeProvider].label}`;
  }
  return terminalRailStateLabel(entry.state);
}
