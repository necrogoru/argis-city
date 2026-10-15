import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  SNAPSHOT_EVENT,
  type Project,
  type Snapshot,
  type Task,
  type TaskAgentResume,
  type TaskDeletionOutcome,
  type TaskGitStatus,
  type TerminalAttachment,
  type TerminalEvent,
  type TerminalTab,
  type TaskWorktree,
} from "../domain/types";
import type { AgentSource } from "./agentSource";

interface TerminalChannelEntry {
  channel: Channel<TerminalEvent>;
  attachmentId: number | null;
}

function terminalChannelKey(taskId: number, tab: TerminalTab): string {
  return `${taskId}:${tab}`;
}

/** AgentSource backed by the Rust commands/events in docs/CONTRACT.md. */
export function createTauriAgentSource(): AgentSource {
  const terminalChannels = new Map<string, TerminalChannelEntry>();

  function makeTerminalChannel(
    key: string,
    callback: (event: TerminalEvent) => void,
  ): TerminalChannelEntry {
    const previous = terminalChannels.get(key);
    if (previous) previous.channel.onmessage = () => {};

    const channel = new Channel<TerminalEvent>();
    const entry = { channel, attachmentId: null };
    channel.onmessage = (event) => {
      if (terminalChannels.get(key) === entry) callback(event);
    };
    terminalChannels.set(key, entry);
    return entry;
  }

  function discardTerminalChannel(key: string, entry: TerminalChannelEntry): void {
    entry.channel.onmessage = () => {};
    if (terminalChannels.get(key) === entry) terminalChannels.delete(key);
  }

  async function keepTerminalAttachment(
    taskId: number,
    tab: TerminalTab,
    key: string,
    entry: TerminalChannelEntry,
    operation: Promise<TerminalAttachment | null>,
  ): Promise<TerminalAttachment | null> {
    try {
      const attachment = await operation;
      if (!attachment) {
        discardTerminalChannel(key, entry);
        return null;
      }
      entry.attachmentId = attachment.attachmentId;
      if (terminalChannels.get(key) !== entry) {
        entry.channel.onmessage = () => {};
        await invoke<boolean>("detach_terminal_session", {
          taskId,
          tab,
          attachmentId: attachment.attachmentId,
        });
      }
      return attachment;
    } catch (error) {
      discardTerminalChannel(key, entry);
      throw error;
    }
  }

  return {
    kind: "live",
    getSnapshot: () => invoke<Snapshot>("get_snapshot"),
    refresh: () => invoke<Snapshot>("refresh_snapshot"),
    openPath: (path) => invoke<void>("open_path", { path }),
    listProjects: () => invoke<Project[]>("list_projects"),
    addProject: (path, createIfMissing) => invoke<Project>("register_project", { path, createIfMissing }),
    listTasks: (projectId) => invoke<Task[]>("list_tasks", { projectId: projectId ?? null }),
    listTaskAgentResumes: () => invoke<TaskAgentResume[]>("list_task_agent_resumes"),
    getTaskAgentResume: (taskId) => invoke<TaskAgentResume | null>("get_task_agent_resume", { taskId }),
    saveTaskAgentResume: (reference) => invoke<TaskAgentResume>("save_task_agent_resume", { reference }),
    createTask: (projectId, title, description) =>
      invoke<Task>("create_task", { projectId, title, description }),
    updateTaskDetails: (id, title, description) =>
      invoke<Task>("update_task_details", { id, title, description }),
    updateTaskStatus: (id, status) => invoke<Task>("update_task_status", { id, status }),
    deleteTask: (id, removeGitResources) =>
      invoke<TaskDeletionOutcome>("delete_task", { id, removeGitResources }),
    getTaskGitStatus: (id) => invoke<TaskGitStatus>("inspect_task_git_status", { taskId: id }),
    createTaskWorktree: (id) => invoke<TaskWorktree>("create_task_worktree", { taskId: id }),
    startTerminalSession(taskId, tab, agentCli, size, onEvent) {
      const key = terminalChannelKey(taskId, tab);
      const entry = makeTerminalChannel(key, onEvent);
      return keepTerminalAttachment(
        taskId,
        tab,
        key,
        entry,
        invoke<TerminalAttachment>("start_terminal_session", { taskId, tab, agentCli, size, onEvent: entry.channel }),
      ).then((attachment) => {
        if (!attachment) throw new Error("terminal session could not be started");
        return attachment;
      });
    },
    reattachTerminalSession(taskId, tab, onEvent) {
      const key = terminalChannelKey(taskId, tab);
      const entry = makeTerminalChannel(key, onEvent);
      return keepTerminalAttachment(
        taskId,
        tab,
        key,
        entry,
        invoke<TerminalAttachment | null>("reattach_terminal_session", { taskId, tab, onEvent: entry.channel }),
      );
    },
    sendTerminalInput: (sessionId, data) => invoke<void>("terminal_input", { sessionId, data }),
    resizeTerminalSession: (sessionId, size) => invoke<void>("resize_terminal_session", { sessionId, size }),
    async detachTerminalSession(taskId, tab, attachmentId) {
      const key = terminalChannelKey(taskId, tab);
      const entry = terminalChannels.get(key);
      if (entry?.attachmentId === attachmentId) discardTerminalChannel(key, entry);
      return invoke<boolean>("detach_terminal_session", { taskId, tab, attachmentId });
    },
    listTerminalInventory: () => invoke("list_terminal_inventory"),
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
