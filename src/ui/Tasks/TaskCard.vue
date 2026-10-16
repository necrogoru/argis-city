<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, ChevronUp, GitBranch, SquareTerminal } from "@lucide/vue";
import type { Task, TaskGitStatus, TaskStatus } from "../../domain/types";
import { nextTaskStatus, previousTaskStatus, TASK_STATUS_LABELS } from "../../domain/tasks";
import { taskFocusDirectionForEvent, type TaskFocusDirection } from "../../domain/taskFocus";
import { canCreateTaskBranch, canOpenTaskTerminal } from "../../domain/taskBoardShortcuts";

const props = defineProps<{
  task: Task;
  projectPath: string;
  gitStatus: TaskGitStatus | null;
  canOpenTerminal?: boolean;
  statusFeedbackVersion?: number;
}>();
const emit = defineEmits<{
  edit: [];
  moveStatus: [status: TaskStatus];
  createBranch: [];
  openTerminal: [];
  focusTask: [];
  blurTask: [];
  navigate: [direction: TaskFocusDirection];
}>();
const cardElement = ref<HTMLElement | null>(null);

const previousStatus = computed(() => previousTaskStatus(props.task.status));
const nextStatus = computed(() => nextTaskStatus(props.task.status));
const branchLabel = computed(() => {
  if (props.task.branchName) return `Branch exists: ${props.task.branchName}`;
  if (!props.gitStatus) return "Checking Git status";
  if (props.gitStatus.reason) return props.gitStatus.reason;
  return props.gitStatus.canCreateBranch ? "Create branch and worktree" : "Git worktree unavailable";
});
const branchDisabled = computed(() => !canCreateTaskBranch(props.task, props.gitStatus));
const terminalLabel = computed(() => {
  if (!props.task.worktreePath) return "Open terminal (create a task worktree first)";
  return props.canOpenTerminal ? "Open terminal" : "Embedded terminal is not available yet";
});
const terminalDisabled = computed(() => !canOpenTaskTerminal(props.task, props.canOpenTerminal));
const projectName = computed(() => props.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? props.projectPath);

function handleKeydown(event: KeyboardEvent): void {
  const card = event.currentTarget as HTMLElement;
  const isWithinCard = event.target === card || (event.target instanceof Node && card.contains(event.target));
  const direction = taskFocusDirectionForEvent(event, isWithinCard);
  if (direction === null) return;

  event.preventDefault();
  emit("navigate", direction);
}

function focus(): void {
  cardElement.value?.focus();
}

defineExpose({ focus });

</script>

<template>
  <article
    ref="cardElement"
    class="task-card"
    :data-status="props.task.status"
    :aria-label="`Task #${props.task.id}: ${props.task.title}`"
    aria-describedby="task-board-navigation-hint"
    aria-keyshortcuts="ArrowLeft ArrowDown ArrowUp ArrowRight h j k l Shift+G"
    tabindex="0"
    @focus="emit('focusTask')"
    @blur="emit('blurTask')"
    @keydown="handleKeydown"
  >
    <div class="task-card-heading">
      <button class="task-title" type="button" :aria-label="`Edit task ${props.task.title}`" @click="emit('edit')">
        {{ props.task.title }}
      </button>
      <span class="task-id">#{{ props.task.id }}</span>
    </div>
    <p class="task-description">{{ props.task.description || "No description" }}</p>

    <div class="task-card-meta">
      <span class="project-name" :title="props.projectPath">{{ projectName }}</span>
      <span
        :key="props.statusFeedbackVersion ?? 0"
        class="status-label"
        :class="{ 'status-label--changed': (props.statusFeedbackVersion ?? 0) > 0 }"
        :data-status="props.task.status"
      >{{ TASK_STATUS_LABELS[props.task.status] }}</span>
    </div>

    <div class="task-actions" role="group" :aria-label="`Actions for ${props.task.title}`">
      <button
        class="task-action"
        type="button"
        :aria-label="branchLabel"
        :title="branchLabel"
        :disabled="branchDisabled"
        @click="emit('createBranch')"
      >
        <GitBranch :size="16" aria-hidden="true" />
      </button>
      <button
        class="task-action"
        type="button"
        :aria-label="terminalLabel"
        :title="terminalLabel"
        :disabled="terminalDisabled"
        @click="emit('openTerminal')"
      >
        <SquareTerminal :size="16" aria-hidden="true" />
      </button>
      <button
        class="task-action"
        type="button"
        :aria-label="`Move ${props.task.title} to previous status`"
        :title="previousStatus ? `Move to ${TASK_STATUS_LABELS[previousStatus]}` : 'Already at the first status'"
        :disabled="previousStatus === null"
        @click="previousStatus && emit('moveStatus', previousStatus)"
      >
        <ChevronUp :size="16" aria-hidden="true" />
      </button>
      <button
        class="task-action"
        type="button"
        :aria-label="`Move ${props.task.title} to next status`"
        :title="nextStatus ? `Move to ${TASK_STATUS_LABELS[nextStatus]}` : 'Already at the last status'"
        :disabled="nextStatus === null"
        @click="nextStatus && emit('moveStatus', nextStatus)"
      >
        <ChevronDown :size="16" aria-hidden="true" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.task-card:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 3px;
}

.task-card-heading,
.task-card-meta,
.task-actions {
  display: flex;
  align-items: center;
}

.task-card-heading {
  justify-content: space-between;
  gap: 12px;
}

.task-title {
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.task-title:hover {
  color: var(--teal);
}

.task-title:focus-visible,
.task-action:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.task-id {
  flex: none;
  color: var(--text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.task-description {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.task-card-meta {
  justify-content: space-between;
  gap: 8px;
}

.project-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-3);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-label {
  --status-color: var(--text-2);

  flex: none;
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--status-color) 42%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--status-color) 12%, transparent);
  color: var(--status-color);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-label[data-status="inProgress"] {
  --status-color: var(--teal);
}

.status-label[data-status="stopped"] {
  --status-color: var(--amber);
}

.status-label[data-status="canceled"] {
  --status-color: var(--red);
}

.status-label[data-status="completed"] {
  --status-color: var(--blue);
}

.status-label--changed {
  animation: task-status-feedback 480ms var(--ease-out) both;
}

@keyframes task-status-feedback {
  from {
    border-color: color-mix(in srgb, var(--status-color) 72%, transparent);
    background: color-mix(in srgb, var(--status-color) 28%, transparent);
  }

  to {
    border-color: color-mix(in srgb, var(--status-color) 42%, transparent);
    background: color-mix(in srgb, var(--status-color) 12%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-label--changed {
    animation: none;
  }
}

.task-actions {
  gap: 6px;
}

.task-action {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}

.task-action:hover:not(:disabled) {
  background: var(--fill-hover);
  color: var(--text);
}

.task-action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
