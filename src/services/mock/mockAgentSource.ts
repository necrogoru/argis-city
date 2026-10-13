import type { Project, Snapshot, Task, TaskDeletionOutcome, TaskStatus } from "../../domain/types";
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
