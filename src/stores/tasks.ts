import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type { Project, Task, TaskDeletionOutcome, TaskGitStatus, TaskStatus, TaskWorktree } from "../domain/types";
import { taskBranchName, taskWorktreePath } from "../domain/tasks";
import { useAgentSource } from "../composables/useAgentSource";
import { useTerminalRailStore } from "./terminalRail";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useTaskStore = defineStore("tasks", () => {
  const source = useAgentSource();
  const terminalRail = useTerminalRailStore();
  const projects = shallowRef<Project[]>([]);
  const tasks = shallowRef<Task[]>([]);
  const gitStatuses = shallowRef<Record<number, TaskGitStatus>>({});
  const loading = ref(false);
  const searchLoading = ref(false);
  const error = ref<string | null>(null);
  let searchDataRevision = 0;
  let loadedSearchDataRevision = -1;
  let searchDataPromise: Promise<void> | null = null;

  function invalidateSearchData(): void {
    searchDataRevision += 1;
  }

  async function ensureSearchDataLoaded(): Promise<void> {
    if (loadedSearchDataRevision === searchDataRevision) return;
    if (searchDataPromise) {
      await searchDataPromise;
      if (loadedSearchDataRevision === searchDataRevision) return;
    }

    const revision = searchDataRevision;
    const promise = Promise.all([source.listProjects(), source.listTasks()]).then(([nextProjects, nextTasks]) => {
      if (revision !== searchDataRevision) return;
      projects.value = nextProjects;
      tasks.value = nextTasks;
      loadedSearchDataRevision = revision;
    });
    searchDataPromise = promise;
    searchLoading.value = true;
    try {
      await promise;
      error.value = null;
    } catch (reason) {
      error.value = errorMessage(reason);
      throw reason;
    } finally {
      if (searchDataPromise === promise) searchDataPromise = null;
      searchLoading.value = false;
    }

    if (loadedSearchDataRevision !== searchDataRevision) await ensureSearchDataLoaded();
  }

  async function perform<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      const result = await operation();
      error.value = null;
      return result;
    } catch (reason) {
      error.value = errorMessage(reason);
      return null;
    }
  }

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    invalidateSearchData();
    try {
      await ensureSearchDataLoaded();
      gitStatuses.value = {};
      await Promise.all(tasks.value.map((task) => refreshTaskGitStatus(task.id)));
    } catch (reason) {
      error.value = errorMessage(reason);
    } finally {
      loading.value = false;
    }
  }

  async function addProject(path: string, createIfMissing: boolean): Promise<Project | null> {
    const project = await perform(() => source.addProject(path, createIfMissing));
    if (project) {
      projects.value = [...projects.value, project];
      invalidateSearchData();
    }
    return project;
  }

  async function createTask(projectId: number, title: string, description: string): Promise<Task | null> {
    const task = await perform(() => source.createTask(projectId, title, description));
    if (task) {
      tasks.value = [...tasks.value, task];
      invalidateSearchData();
      await refreshTaskGitStatus(task.id);
    }
    return task;
  }

  async function updateTaskDetails(id: number, title: string, description: string): Promise<Task | null> {
    const updated = await perform(() => source.updateTaskDetails(id, title, description));
    if (updated) {
      tasks.value = tasks.value.map((task) => (task.id === id ? updated : task));
      invalidateSearchData();
      await refreshTaskGitStatus(id);
    }
    return updated;
  }

  async function updateTaskStatus(id: number, status: TaskStatus): Promise<Task | null> {
    const updated = await perform(() => source.updateTaskStatus(id, status));
    if (updated) {
      tasks.value = tasks.value.map((task) => (task.id === id ? updated : task));
      invalidateSearchData();
    }
    return updated;
  }

  async function deleteTask(id: number, removeGitResources: boolean): Promise<TaskDeletionOutcome | null> {
    const outcome = await perform(() => source.deleteTask(id, removeGitResources));
    if (!outcome?.taskDeleted) return null;
    tasks.value = tasks.value.filter((task) => task.id !== id);
    invalidateSearchData();
    terminalRail.clearTaskStatus(id);
    const nextStatuses = { ...gitStatuses.value };
    delete nextStatuses[id];
    gitStatuses.value = nextStatuses;
    return outcome;
  }

  async function refreshTaskGitStatus(id: number): Promise<TaskGitStatus | null> {
    const task = tasks.value.find((candidate) => candidate.id === id);
    if (!task) return null;
    try {
      const status = await source.getTaskGitStatus(id);
      gitStatuses.value = { ...gitStatuses.value, [id]: status };
      return status;
    } catch (reason) {
      const project = projects.value.find((candidate) => candidate.id === task.projectId);
      const status: TaskGitStatus = {
        isGitRepository: false,
        canCreateBranch: false,
        branchExists: false,
        branchName: task.branchName ?? taskBranchName(task.id, task.title),
        worktreePath: task.worktreePath ?? taskWorktreePath(project?.path ?? "", task.id, task.title),
        reason: errorMessage(reason),
      };
      gitStatuses.value = { ...gitStatuses.value, [id]: status };
      return status;
    }
  }

  async function createTaskWorktree(id: number): Promise<TaskWorktree | null> {
    const worktree = await perform(() => source.createTaskWorktree(id));
    if (!worktree) {
      await refreshTaskGitStatus(id);
      return null;
    }
    tasks.value = tasks.value.map((task) =>
      task.id === id ? { ...task, branchName: worktree.branchName, worktreePath: worktree.worktreePath } : task,
    );
    invalidateSearchData();
    await refreshTaskGitStatus(id);
    return worktree;
  }

  return {
    projects,
    tasks,
    gitStatuses,
    loading,
    searchLoading,
    error,
    ensureSearchDataLoaded,
    load,
    addProject,
    createTask,
    updateTaskDetails,
    updateTaskStatus,
    deleteTask,
    refreshTaskGitStatus,
    createTaskWorktree,
  };
});
