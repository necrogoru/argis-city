import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type { Project, Task, TaskStatus } from "../domain/types";
import { useAgentSource } from "../composables/useAgentSource";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useTaskStore = defineStore("tasks", () => {
  const source = useAgentSource();
  const projects = shallowRef<Project[]>([]);
  const tasks = shallowRef<Task[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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
    try {
      const [nextProjects, nextTasks] = await Promise.all([source.listProjects(), source.listTasks()]);
      projects.value = nextProjects;
      tasks.value = nextTasks;
    } catch (reason) {
      error.value = errorMessage(reason);
    } finally {
      loading.value = false;
    }
  }

  async function addProject(path: string, createIfMissing: boolean): Promise<Project | null> {
    const project = await perform(() => source.addProject(path, createIfMissing));
    if (project) projects.value = [...projects.value, project];
    return project;
  }

  async function createTask(projectId: number, title: string, description: string): Promise<Task | null> {
    const task = await perform(() => source.createTask(projectId, title, description));
    if (task) tasks.value = [...tasks.value, task];
    return task;
  }

  async function updateTaskDetails(id: number, title: string, description: string): Promise<Task | null> {
    const updated = await perform(() => source.updateTaskDetails(id, title, description));
    if (updated) tasks.value = tasks.value.map((task) => (task.id === id ? updated : task));
    return updated;
  }

  async function updateTaskStatus(id: number, status: TaskStatus): Promise<Task | null> {
    const updated = await perform(() => source.updateTaskStatus(id, status));
    if (updated) tasks.value = tasks.value.map((task) => (task.id === id ? updated : task));
    return updated;
  }

  async function deleteTask(id: number): Promise<boolean> {
    const deleted = await perform(async () => {
      await source.deleteTask(id);
      return true;
    });
    if (!deleted) return false;
    tasks.value = tasks.value.filter((task) => task.id !== id);
    return true;
  }

  return { projects, tasks, loading, error, load, addProject, createTask, updateTaskDetails, updateTaskStatus, deleteTask };
});
