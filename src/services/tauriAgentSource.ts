import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  SNAPSHOT_EVENT,
  type Project,
  type Snapshot,
  type Task,
  type TaskDeletionOutcome,
  type TaskGitStatus,
  type TaskWorktree,
} from "../domain/types";
import type { AgentSource } from "./agentSource";

/** AgentSource backed by the Rust commands/events in docs/CONTRACT.md. */
export function createTauriAgentSource(): AgentSource {
  return {
    kind: "live",
    getSnapshot: () => invoke<Snapshot>("get_snapshot"),
    refresh: () => invoke<Snapshot>("refresh_snapshot"),
    openPath: (path) => invoke<void>("open_path", { path }),
    listProjects: () => invoke<Project[]>("list_projects"),
    addProject: (path, createIfMissing) => invoke<Project>("register_project", { path, createIfMissing }),
    listTasks: (projectId) => invoke<Task[]>("list_tasks", { projectId: projectId ?? null }),
    createTask: (projectId, title, description) =>
      invoke<Task>("create_task", { projectId, title, description }),
    updateTaskDetails: (id, title, description) =>
      invoke<Task>("update_task_details", { id, title, description }),
    updateTaskStatus: (id, status) => invoke<Task>("update_task_status", { id, status }),
    deleteTask: (id, removeGitResources) =>
      invoke<TaskDeletionOutcome>("delete_task", { id, removeGitResources }),
    getTaskGitStatus: (id) => invoke<TaskGitStatus>("inspect_task_git_status", { taskId: id }),
    createTaskWorktree: (id) => invoke<TaskWorktree>("create_task_worktree", { taskId: id }),
    subscribe(callback) {
      let unlisten: UnlistenFn | null = null;
      let disposed = false;
      listen<Snapshot>(SNAPSHOT_EVENT, (event) => callback(event.payload))
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch((error: unknown) => console.error("[argis] snapshot listener failed", error));
      return () => {
        disposed = true;
        unlisten?.();
      };
    },
  };
}
