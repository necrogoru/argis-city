import type {
  Project,
  Snapshot,
  Task,
  TaskAgentResume,
  TaskDeletionOutcome,
  TaskGitStatus,
  TaskStatus,
  TaskWorktree,
  TerminalAgent,
  TerminalAttachment,
  TerminalEvent,
  TerminalInventoryEntry,
  TerminalSize,
  TerminalTab,
} from "../../domain/types";
import { taskBranchName, taskWorktreePath } from "../../domain/tasks";
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
  private nextProjectId = 1;
  private nextTaskId = 1;

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
    return this.tasks.filter((task) => projectId === undefined || task.projectId === projectId).map((task) => ({ ...task }));
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

  async createTask(projectId: number, title: string, description: string): Promise<Task> {
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
    };
    this.tasks.push(task);
    return { ...task };
  }

  async updateTaskDetails(id: number, title: string, description: string): Promise<Task> {
    const task = this.findTask(id);
    task.title = title;
    task.description = description;
    return { ...task };
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
    _onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalAttachment | null> {
    return null;
  }

  async sendTerminalInput(_sessionId: number, _data: string): Promise<void> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async resizeTerminalSession(_sessionId: number, _size: TerminalSize): Promise<void> {
    throw new Error("Embedded terminal processes are only available in the Argis desktop app");
  }

  async detachTerminalSession(_taskId: number, _tab: TerminalTab, _attachmentId: number): Promise<boolean> {
    return false;
  }

  async listTerminalInventory(): Promise<TerminalInventoryEntry[]> {
    return [];
  }

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
