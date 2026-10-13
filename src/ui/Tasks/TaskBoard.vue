<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import type { Task, TaskStatus } from "../../domain/types";
import { groupTasks } from "../../domain/tasks";
import { useTaskStore } from "../../stores/tasks";
import ProjectManagerDialog from "./ProjectManagerDialog.vue";
import TaskCard from "./TaskCard.vue";
import TaskEditorDialog from "./TaskEditorDialog.vue";

const store = useTaskStore();
const projectFilter = ref<number | null>(null);
const projectFilterValue = computed({
  get: () => (projectFilter.value == null ? "" : String(projectFilter.value)),
  set: (value: string) => {
    projectFilter.value = value ? Number(value) : null;
  },
});
const groups = computed(() => {
  const grouped = groupTasks(store.tasks, projectFilter.value);
  return [
    { id: "pending", title: "Pending", tasks: grouped.pending },
    { id: "inProgress", title: "In progress", tasks: grouped.inProgress },
    { id: "other", title: "Other statuses", tasks: grouped.other },
  ];
});
const projectPaths = computed(() => new Map(store.projects.map((project) => [project.id, project.path])));
const projectsOpen = ref(false);
const taskEditorOpen = ref(false);
const editingTask = shallowRef<Task | null>(null);

function createTask(): void {
  editingTask.value = null;
  taskEditorOpen.value = true;
}

function editTask(task: Task): void {
  editingTask.value = task;
  taskEditorOpen.value = true;
}

function updateStatus(task: Task, status: TaskStatus): void {
  void store.updateTaskStatus(task.id, status);
}
</script>

<template>
  <section class="task-board" aria-label="Tasks grouped by status">
    <div class="board-toolbar">
      <label class="project-filter" for="task-project-filter">
        <span>Project</span>
        <select id="task-project-filter" v-model="projectFilterValue">
          <option value="">All projects</option>
          <option v-for="project in store.projects" :key="project.id" :value="String(project.id)">
            {{ project.path.split(/[\\/]/).filter(Boolean).at(-1) }}
          </option>
        </select>
      </label>
      <div class="toolbar-actions">
        <button class="manage-button" type="button" @click="projectsOpen = true">Manage projects</button>
        <button class="new-task-button" type="button" :disabled="store.projects.length === 0" @click="createTask">
          New task
        </button>
      </div>
    </div>

    <p v-if="store.error" class="board-error" role="alert">{{ store.error }}</p>
    <p v-if="store.projects.length === 0" class="board-empty" role="status">
      Add a project directory to start organizing tasks.
    </p>

    <div v-if="store.loading" class="board-loading" role="status" aria-busy="true">Loading tasks…</div>
    <div v-else class="task-columns">
      <section v-for="group in groups" :key="group.id" class="task-column" :aria-labelledby="`group-${group.id}`">
        <header class="column-header">
          <h2 :id="`group-${group.id}`">{{ group.title }}</h2>
          <span class="column-count">{{ group.tasks.length }}</span>
        </header>
        <ul v-if="group.tasks.length" class="task-list">
          <li v-for="task in group.tasks" :key="task.id">
            <TaskCard
              :task="task"
              :project-path="projectPaths.get(task.projectId) ?? 'Unknown project'"
              branch-disabled-reason="Git worktree support is not connected yet"
              @edit="editTask(task)"
              @move-status="updateStatus(task, $event)"
            />
          </li>
        </ul>
        <p v-else class="column-empty">No tasks in this group.</p>
      </section>
    </div>

    <ProjectManagerDialog v-model:open="projectsOpen" :projects="store.projects" />
    <TaskEditorDialog v-model:open="taskEditorOpen" :projects="store.projects" :task="editingTask" />
  </section>
</template>

<style scoped>
.task-board {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.board-toolbar,
.toolbar-actions {
  display: flex;
  align-items: end;
  gap: 12px;
}

.board-toolbar {
  justify-content: space-between;
}

.project-filter {
  display: grid;
  gap: 6px;
  width: min(300px, 100%);
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.5px;
}

.project-filter select {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.project-filter select:focus-visible,
.manage-button:focus-visible,
.new-task-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.manage-button,
.new-task-button {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.manage-button {
  background: var(--fill-subtle);
  color: var(--text);
}

.new-task-button {
  border-color: var(--teal);
  background: var(--teal);
  color: var(--text-on-accent);
  font-weight: 500;
}

.new-task-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.board-error {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}

.board-empty,
.board-loading {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
  color: var(--text-2);
  font-size: 13px;
}

.task-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 16px;
}

.task-column {
  display: grid;
  min-width: 0;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  background: var(--fill-subtle);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.column-header h2 {
  margin: 0;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.column-count {
  display: grid;
  min-width: 24px;
  height: 22px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--fill-hover);
  color: var(--text-2);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.task-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.column-empty {
  margin: 0;
  padding: 12px 4px;
  color: var(--text-3);
  font-size: 12px;
}

@media (max-width: 900px) {
  .task-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .board-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }
}
</style>
