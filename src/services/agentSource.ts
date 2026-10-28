import type {
  FileDropEvent,
  Project,
  Snapshot,
  Task,
  TaskAgentResume,
  TaskDeletionOutcome,
  TaskGitStatus,
  TaskImageFile,
  TaskImageInput,
  TaskStatus,
  TaskWorktree,
  TerminalAgent,
  TerminalAttachment,
  TerminalEvent,
  TerminalInventoryEntry,
  TerminalLifecycleEvent,
  TerminalSize,
  TerminalTab,
} from "../domain/types";

/**
 * Where snapshots come from. Components depend on this abstraction only
 * (injected via `AgentSourceProvider`), never on Tauri directly.
 */
export interface AgentSource {
  /** "live" = Tauri backend, "demo" = in-browser mock data. */
  readonly kind: "live" | "demo";
  getSnapshot(): Promise<Snapshot>;
  /** Force a collect now and return the fresh snapshot. */
  refresh(): Promise<Snapshot>;
  /** Called on every poll tick; returns an unsubscribe function. */
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  /** Called once for each Argis-managed terminal process exit; independent of terminal attachments. */
  subscribeTerminalExit(callback: (event: TerminalLifecycleEvent) => void): () => void;
  /** Play Argis's bundled alert sound when an alert is delivered. */
  playAlertSound(): Promise<void>;
  /** Reveal a directory in the OS file manager. */
  openPath(path: string): Promise<void>;
  listProjects(): Promise<Project[]>;
  addProject(path: string, createIfMissing: boolean): Promise<Project>;
  listTasks(projectId?: number): Promise<Task[]>;
  listTaskAgentResumes(): Promise<TaskAgentResume[]>;
  getTaskAgentResume(taskId: number): Promise<TaskAgentResume | null>;
  saveTaskAgentResume(reference: TaskAgentResume): Promise<TaskAgentResume>;
  createTask(
    projectId: number,
    title: string,
    description: string,
    images: readonly TaskImageInput[],
  ): Promise<Task>;
  updateTaskDetails(
    id: number,
    title: string,
    description: string,
    images: readonly TaskImageInput[],
  ): Promise<Task>;
  /** Raw bytes of a stored task image. */
  readTaskImage(imageId: number): Promise<ArrayBuffer>;
  /** Reads an image file picked from a native drag-and-drop payload. */
  readImageFile(path: string): Promise<TaskImageFile>;
  /** Native file-drop notifications; the browser mock never emits any. */
  subscribeFileDrop(callback: (event: FileDropEvent) => void): () => void;
  updateTaskStatus(id: number, status: TaskStatus): Promise<Task>;
  deleteTask(id: number, removeGitResources: boolean): Promise<TaskDeletionOutcome>;
  getTaskGitStatus(id: number): Promise<TaskGitStatus>;
  createTaskWorktree(id: number): Promise<TaskWorktree>;
  startTerminalSession(
    taskId: number,
    tab: TerminalTab,
    agentCli: TerminalAgent | null,
    size: TerminalSize,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment>;
  /** Resume the task's saved native conversation in a new Agent PTY. */
  resumeTaskAgent(
    taskId: number,
    size: TerminalSize,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment>;
  reattachTerminalSession(
    taskId: number,
    tab: TerminalTab,
    size: TerminalSize | null,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment | null>;
  sendTerminalInput(sessionId: number, data: string): Promise<void>;
  resizeTerminalSession(sessionId: number, size: TerminalSize): Promise<void>;
  detachTerminalSession(taskId: number, tab: TerminalTab, attachmentId: number): Promise<boolean>;
  listTerminalInventory(): Promise<TerminalInventoryEntry[]>;
}

/** Poll interval the backend (and the mock) emit snapshots at. */
export const POLL_INTERVAL_MS = 2_000;
