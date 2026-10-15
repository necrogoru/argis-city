<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type { Task, TaskDeletionOutcome, TaskStatus } from "../../domain/types";
import { groupTasks } from "../../domain/tasks";
import { nextVisibleTaskId, type TaskFocusDirection } from "../../domain/taskFocus";
import { searchBoardTasks } from "../../domain/taskSearch";
import {
  canCreateTaskBranch,
  canCreateTaskFromBoard,
  canOpenTaskTerminal,
  focusedVisibleTask,
  taskBoardActionForShortcut,
} from "../../domain/taskBoardShortcuts";
import { useTaskStore } from "../../stores/tasks";
import ProjectManagerDialog from "./ProjectManagerDialog.vue";
import TaskCard from "./TaskCard.vue";
import TaskEditorDialog from "./TaskEditorDialog.vue";
import { useTerminalNavigationStore } from "../../stores/terminalNavigation";

const store = useTaskStore();
const terminalNavigation = useTerminalNavigationStore();
const projectFilter = ref<number | null>(null);
const taskSearchQuery = ref("");
const focusedTaskId = ref<number | null>(null);
type TaskCardHandle = { focus: () => void };
const taskCardRefs = new Map<number, TaskCardHandle>();
const projectFilterValue = computed({
  get: () => (projectFilter.value == null ? "" : String(projectFilter.value)),
  set: (value: string) => {
    projectFilter.value = value ? Number(value) : null;
  },
});
const groups = computed(() => {
  const matchingTasks = searchBoardTasks(store.tasks, store.projects, taskSearchQuery.value, projectFilter.value);
  const grouped = groupTasks(matchingTasks);
  return [
    { id: "pending", title: "Pending", tasks: grouped.pending },
    { id: "inProgress", title: "In progress", tasks: grouped.inProgress },
    { id: "other", title: "Other statuses", tasks: grouped.other },
  ];
});
const visibleTaskIds = computed(() =>
  store.loading ? [] : groups.value.flatMap((group) => group.tasks.map((task) => task.id)),
);
const projectPaths = computed(() => new Map(store.projects.map((project) => [project.id, project.path])));
const projectsOpen = ref(false);
const taskEditorOpen = ref(false);
const editingTask = shallowRef<Task | null>(null);
const deletionNotice = ref<string | null>(null);

watch(visibleTaskIds, (taskIds) => {
  if (focusedTaskId.value != null && !taskIds.includes(focusedTaskId.value)) focusedTaskId.value = null;
});

function setTaskCardRef(taskId: number, card: TaskCardHandle | null): void {
  if (card) taskCardRefs.set(taskId, card);
  else taskCardRefs.delete(taskId);
}

function focusNextVisibleTask(currentTaskId: number | null, direction: TaskFocusDirection): void {
  const nextTaskId = nextVisibleTaskId(visibleTaskIds.value, currentTaskId, direction);
  if (nextTaskId == null) return;

  focusedTaskId.value = nextTaskId;
  taskCardRefs.get(nextTaskId)?.focus();
}

function handleSearchKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

  event.preventDefault();
  focusNextVisibleTask(null, event.key === "ArrowDown" ? "down" : "up");
}

function setFocusedTask(taskId: number): void {
  focusedTaskId.value = taskId;
}

function clearFocusedTask(taskId: number): void {
  if (focusedTaskId.value === taskId) focusedTaskId.value = null;
}

function handleTaskNavigation(taskId: number, direction: TaskFocusDirection): void {
  focusNextVisibleTask(taskId, direction);
}

function handleTaskBoardShortcut(event: KeyboardEvent): void {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const hasOpenDialog =
    projectsOpen.value || taskEditorOpen.value || document.querySelector("dialog[open]") !== null;
  const action = taskBoardActionForShortcut(event, target, hasOpenDialog);
  if (action === null) return;

  if (action === "createTask") {
    if (!canCreateTaskFromBoard(store.projects.length)) return;
    event.preventDefault();
    createTask();
    return;
  }

  const task = focusedVisibleTask(focusedTaskId.value, visibleTaskIds.value, store.tasks);
  if (!task) return;

  if (action === "createBranch") {
    if (!canCreateTaskBranch(task, store.gitStatuses[task.id] ?? null)) return;
    event.preventDefault();
    createBranch(task);
    return;
  }

  if (!canOpenTaskTerminal(task, task.worktreePath !== null)) return;
  event.preventDefault();
  openTerminal(task);
}

onMounted(() => window.addEventListener("keydown", handleTaskBoardShortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", handleTaskBoardShortcut));

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

function createBranch(task: Task): void {
  void store.createTaskWorktree(task.id);
}

function openTerminal(task: Task): void {
  terminalNavigation.openTaskTerminal(task.id);
}

function handleTaskDeleted(outcome: TaskDeletionOutcome): void {
  if (editingTask.value) terminalNavigation.clearTaskTerminal(editingTask.value.id);
  if (!outcome.git.error) {
    deletionNotice.value = null;
    return;
  }

  const remaining: string[] = [];
  if (outcome.git.worktreePath && !outcome.git.worktreeRemoved) remaining.push(`worktree at ${outcome.git.worktreePath}`);
  if (outcome.git.branchName && !outcome.git.branchRemoved) remaining.push(`branch ${outcome.git.branchName}`);
  const retained = remaining.length > 0 ? ` Retained ${remaining.join(" and ")}.` : "";
  deletionNotice.value = `Task deleted, but Git cleanup failed: ${outcome.git.error}.${retained}`;
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
      <label class="task-search" for="task-search">
        <span>Search tasks</span>
        <input
          id="task-search"
          v-model="taskSearchQuery"
          type="search"
          placeholder="Search by title, ID, description, or project"
          aria-describedby="task-search-hint"
          autocomplete="off"
          @keydown="handleSearchKeydown"
        />
      </label>
      <div class="toolbar-actions">
        <button class="manage-button" type="button" @click="projectsOpen = true">Manage projects</button>
        <button
          class="new-task-button"
          type="button"
          :disabled="!canCreateTaskFromBoard(store.projects.length)"
          @click="createTask"
        >
          New task
        </button>
      </div>
    </div>

    <p v-if="store.error" class="board-error" role="alert">{{ store.error }}</p>
    <div v-if="deletionNotice" class="deletion-notice" role="alert">
      <p>{{ deletionNotice }}</p>
      <button type="button" aria-label="Dismiss Git cleanup notice" @click="deletionNotice = null">Dismiss</button>
    </div>
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
              :ref="(card) => setTaskCardRef(task.id, card as TaskCardHandle | null)"
              :task="task"
              :project-path="projectPaths.get(task.projectId) ?? 'Unknown project'"
              :git-status="store.gitStatuses[task.id] ?? null"
              :can-open-terminal="task.worktreePath !== null"
              @edit="editTask(task)"
              @move-status="updateStatus(task, $event)"
              @create-branch="createBranch(task)"
              @open-terminal="openTerminal(task)"
              @focus-task="setFocusedTask(task.id)"
              @blur-task="clearFocusedTask(task.id)"
              @navigate="handleTaskNavigation(task.id, $event)"
            />
          </li>
        </ul>
        <p v-else class="column-empty">No tasks in this group.</p>
      </section>
    </div>
    <span id="task-search-hint" class="visually-hidden">
      Use the up and down arrow keys to move focus through matching tasks.
    </span>

    <ProjectManagerDialog v-model:open="projectsOpen" :projects="store.projects" />
    <TaskEditorDialog
      v-model:open="taskEditorOpen"
      :projects="store.projects"
      :task="editingTask"
      @deleted="handleTaskDeleted"
    />
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
  gap: 12px;
}

.project-filter,
.task-search {
  display: grid;
  gap: 6px;
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.5px;
}

.project-filter {
  width: min(300px, 100%);
}

.task-search {
  flex: 1;
  min-width: 180px;
  max-width: 440px;
}

.project-filter select,
.task-search input {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.task-search input::placeholder {
  color: var(--text-3);
  opacity: 1;
}

.project-filter select:focus-visible,
.task-search input:focus-visible,
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

.deletion-notice {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--amber) 28%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--amber) 9%, transparent);
  color: var(--amber);
  font-size: 13px;
}

.deletion-notice p {
  margin: 0;
  overflow-wrap: anywhere;
}

.deletion-notice button {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.deletion-notice button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
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

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.column-empty {
  margin: 0;
  padding: 12px 4px;
  color: var(--text-3);
  font-size: 12px;
}

@media (max-width: 900px) {
  .board-toolbar {
    flex-wrap: wrap;
  }

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

  .task-search {
    max-width: none;
  }
}
</style>
