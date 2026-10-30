import type {
  FileDropEvent,
  Project,
  Snapshot,
  Task,
  TaskAgentResume,
  TaskDeletionOutcome,
  TaskGitStatus,
  TaskImage,
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
} from "../../domain/types";
import { taskBranchName, taskWorktreePath } from "../../domain/tasks";
import {
  base64ToBytes,
  MAX_TASK_IMAGES,
  MAX_TASK_IMAGE_BYTES,
  sniffImageMimeType,
} from "../../domain/imageFiles";
import { POLL_INTERVAL_MS, type AgentSource } from "../agentSource";
import { buildSession } from "./mockFactory";
import { SESSION_SEEDS } from "./mockSeed";
import { providerSummaries, tickSnapshot } from "./mockTick";

/** "busy" = the full demo city; "empty" = no sessions, Pi not installed. */
export type MockScenario = "busy" | "empty";

export function createSeedSnapshot(now: number, scenario: MockScenario = "busy"): Snapshot {
  const seeds = scenario === "busy" ? SESSION_SEEDS : [];
  const sessions = seeds.map((seed, i) => buildSession(seed, i + 1, now));
  const missing = scenario === "empty" ? (["pi"] as const) : [];
  return { generatedAt: now, sessions, providers: providerSummaries(sessions, missing) };
}

/** In-browser stand-in for the Tauri backend: realistic data that ticks every 2 s. */
export class MockAgentSource implements AgentSource {
  readonly kind = "demo" as const;
  private snapshot: Snapshot;
  private readonly listeners = new Set<(snapshot: Snapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private readonly taskAgentResumes = new Map<number, TaskAgentResume>();
  private readonly taskImageBytes = new Map<number, Uint8Array>();
  private nextProjectId = 1;
  private nextTaskId = 1;
  private nextTaskImageId = 1;

  constructor(
    scenario: MockScenario = "busy",
    private readonly intervalMs = POLL_INTERVAL_MS,
    private readonly rnd: () => number = Math.random,
  ) {
    this.snapshot = createSeedSnapshot(Date.now(), scenario);
  }

  async getSnapshot(): Promise<Snapshot> {
    return this.snapshot;
  }

  async refresh(): Promise<Snapshot> {
    this.advance();
    return this.snapshot;
  }

  subscribe(callback: (snapshot: Snapshot) => void): () => void {
    this.listeners.add(callback);
    this.timer ??= setInterval(() => this.advance(), this.intervalMs);
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  subscribeTerminalExit(_callback: (event: TerminalLifecycleEvent) => void): () => void {
    return () => {};
  }

  async openPath(path: string): Promise<void> {
    console.info(`[argis mock] would reveal ${path} in Finder`);
  }

  async listProjects(): Promise<Project[]> {
    return this.projects.map((project) => ({ ...project }));
  }

  async addProject(path: string, _createIfMissing: boolean): Promise<Project> {
    const project = { id: this.nextProjectId++, path };
    this.projects.push(project);
    return { ...project };
  }

  async listTasks(projectId?: number): Promise<Task[]> {
    return this.tasks
      .filter((task) => projectId === undefined || task.projectId === projectId)
      .map((task) => ({ ...task, images: task.images.map((image) => ({ ...image })) }));
  }

  async listTaskAgentResumes(): Promise<TaskAgentResume[]> {
    return [...this.taskAgentResumes.values()]
      .sort((a, b) => a.taskId - b.taskId)
      .map((reference) => ({ ...reference }));
  }

  async getTaskAgentResume(taskId: number): Promise<TaskAgentResume | null> {
    const reference = this.taskAgentResumes.get(taskId);
    return reference ? { ...reference } : null;
  }

  async saveTaskAgentResume(reference: TaskAgentResume): Promise<TaskAgentResume> {
    this.findTask(reference.taskId);
    if (!reference.nativeReference.trim() || !reference.worktreePath.startsWith("/")) {
      throw new Error("invalid task agent resume reference");
    }
    if (!Number.isSafeInteger(reference.lastObservedAtMs) || reference.lastObservedAtMs < 0) {
      throw new Error("invalid task agent resume timestamp");
    }
    const saved = { ...reference };
    this.taskAgentResumes.set(reference.taskId, saved);
    return { ...saved };
  }

  async createTask(
    projectId: number,
    title: string,
    description: string,
    images: readonly TaskImageInput[],
  ): Promise<Task> {
    if (!this.projects.some((project) => project.id === projectId)) {
      throw new Error(`project ${projectId} does not exist`);
    }
    const task: Task = {
      id: this.nextTaskId++,
      projectId,
      title,
      description,
      status: "pending",
      branchName: null,
      worktreePath: null,
      images: [],
    };
    this.applyTaskImages(task, images, true);
    this.tasks.push(task);
    return { ...task, images: task.images.map((image) => ({ ...image })) };
  }

  async updateTaskDetails(
    id: number,
    title: string,
    description: string,
    images: readonly TaskImageInput[],
  ): Promise<Task> {
    const task = this.findTask(id);
    this.applyTaskImages(task, images, false);
    task.title = title;
    task.description = description;
    return { ...task, images: task.images.map((image) => ({ ...image })) };
  }

  private applyTaskImages(task: Task, inputs: readonly TaskImageInput[], newTask: boolean): void {
    const kept = new Set<number>();
    const additions: TaskImageInput[] = [];
    for (const input of inputs) {
      if (input.imageId == null) {
        if (input.dataBase64 == null) throw new Error("a new task image needs dataBase64");
        additions.push(input);
        continue;
      }
      if (newTask) throw new Error("a new task cannot reference an existing image");
      if (input.dataBase64 != null) throw new Error("an existing task image must not carry new image data");
      if (!task.images.some((image) => image.id === input.imageId)) {
        throw new Error(`task image ${input.imageId} does not belong to task ${task.id}`);
      }
      if (kept.has(input.imageId)) throw new Error(`task image ${input.imageId} is listed twice`);
      kept.add(input.imageId);
    }
    if (kept.size + additions.length > MAX_TASK_IMAGES) {
      throw new Error(`a task can hold at most ${MAX_TASK_IMAGES} images`);
    }

    const keptImages = task.images.filter((image) => kept.has(image.id));
    let total = keptImages.reduce((sum, image) => sum + image.byteSize, 0);
    const decoded = additions.map((input) => {
      const bytes = base64ToBytes(input.dataBase64 ?? "");
      if (bytes.length === 0) throw new Error("task image data is empty");
      if (sniffImageMimeType(bytes) !== input.mimeType) throw new Error("task image type does not match");
      total += bytes.length;
      return { input, bytes };
    });
    if (total > MAX_TASK_IMAGE_BYTES) throw new Error("task images exceed the 30 MB per-task budget");

    const removed = task.images.filter((image) => !kept.has(image.id));
    task.images = keptImages;
    for (const image of removed) this.taskImageBytes.delete(image.id);
    for (const { input, bytes } of decoded) {
      const image: TaskImage = {
        id: this.nextTaskImageId++,
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteSize: bytes.length,
      };
      this.taskImageBytes.set(image.id, bytes);
      task.images.push(image);
    }
  }

  async readTaskImage(imageId: number): Promise<ArrayBuffer> {
    const bytes = this.taskImageBytes.get(imageId);
    if (!bytes) throw new Error(`task image ${imageId} does not exist`);
    return bytes.slice().buffer;
  }

  async readImageFile(_path: string): Promise<TaskImageFile> {
    throw new Error("Reading image files is only available in the Argis desktop app");
  }

  subscribeFileDrop(_callback: (event: FileDropEvent) => void): () => void {
    return () => {};
  }

  async updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
    const task = this.findTask(id);
    task.status = status;
    return { ...task };
  }

  async deleteTask(id: number, removeGitResources: boolean): Promise<TaskDeletionOutcome> {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index < 0) throw new Error(`task ${id} does not exist`);
    const [task] = this.tasks.splice(index, 1);
    this.taskAgentResumes.delete(id);
    for (const image of task.images) this.taskImageBytes.delete(image.id);
    return {
      taskDeleted: true,
      git: {
        requested: removeGitResources,
        worktreeRemoved: removeGitResources && task.worktreePath !== null,
        branchRemoved: removeGitResources && task.branchName !== null,
        branchName: task.branchName,
        worktreePath: task.worktreePath,
        error: null,
      },
    };
  }

  async getTaskGitStatus(id: number): Promise<TaskGitStatus> {
    const task = this.findTask(id);
    const project = this.projects.find((candidate) => candidate.id === task.projectId);
    if (!project) throw new Error(`project ${task.projectId} does not exist`);
    const linked = task.branchName !== null || task.worktreePath !== null;
    return {
      isGitRepository: true,
      canCreateBranch: !linked,
      branchExists: task.branchName !== null,
      branchName: task.branchName ?? taskBranchName(task.id, task.title),
      worktreePath: task.worktreePath ?? taskWorktreePath(project.path, task.id, task.title),
      reason: linked ? "Task already has a branch or worktree" : null,
    };
  }

  async createTaskWorktree(id: number): Promise<TaskWorktree> {
    const status = await this.getTaskGitStatus(id);
    if (!status.canCreateBranch) throw new Error(status.reason ?? "Git worktree is unavailable");
    const task = this.findTask(id);
    task.branchName = status.branchName;
    task.worktreePath = status.worktreePath;
    return { branchName: status.branchName, worktreePath: status.worktreePath };
  }

  async startTerminalSession(
    _taskId: number,
    _tab: TerminalTab,
    _agentCli: TerminalAgent | null,
    _size: TerminalSize,
    _onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async reattachTerminalSession(
    _taskId: number,
    _tab: TerminalTab,
    _size: TerminalSize | null,
    _onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment | null> {
    return null;
  }

  async resumeTaskAgent(
    _taskId: number,
    _size: TerminalSize,
    _onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async sendTerminalInput(_sessionId: number, _data: string): Promise<void> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async resizeTerminalSession(_sessionId: number, _size: TerminalSize): Promise<void> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async stopTerminalSession(_sessionId: number): Promise<void> {}

  async forgetTerminalTab(_taskId: number, _tab: TerminalTab): Promise<boolean> {
    return false;
  }

  async detachTerminalSession(_taskId: number, _tab: TerminalTab, _attachmentId: number): Promise<boolean> {
    return false;
  }

  async listTerminalInventory(): Promise<TerminalInventoryEntry[]> {
    return [];
  }

  async playAlertSound(): Promise<void> {}

  private findTask(id: number): Task {
    const task = this.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new Error(`task ${id} does not exist`);
    return task;
  }

  private advance(): void {
    this.ticks += 1;
    this.snapshot = tickSnapshot(this.snapshot, Date.now(), this.rnd, this.ticks);
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
