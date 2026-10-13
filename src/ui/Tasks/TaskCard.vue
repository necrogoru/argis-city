<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, ChevronUp, GitBranch, SquareTerminal } from "@lucide/vue";
import type { Task, TaskGitStatus, TaskStatus } from "../../domain/types";
import { nextTaskStatus, previousTaskStatus } from "../../domain/tasks";

const props = defineProps<{
  task: Task;
  projectPath: string;
  gitStatus: TaskGitStatus | null;
  canOpenTerminal?: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  moveStatus: [status: TaskStatus];
  createBranch: [];
  openTerminal: [];
}>();

const previousStatus = computed(() => previousTaskStatus(props.task.status));
const nextStatus = computed(() => nextTaskStatus(props.task.status));
const branchLabel = computed(() => {
  if (props.task.branchName) return `Branch exists: ${props.task.branchName}`;
  if (!props.gitStatus) return "Checking Git status";
  if (props.gitStatus.reason) return props.gitStatus.reason;
  return props.gitStatus.canCreateBranch ? "Create branch and worktree" : "Git worktree unavailable";
});
const branchDisabled = computed(() => !props.gitStatus?.canCreateBranch || props.task.branchName !== null);
const terminalLabel = computed(() => {
  if (!props.task.worktreePath) return "Open terminal (create a task worktree first)";
  return props.canOpenTerminal ? "Open terminal" : "Embedded terminal is not available yet";
});
const terminalDisabled = computed(() => !props.canOpenTerminal || props.task.worktreePath === null);
const projectName = computed(() => props.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? props.projectPath);

const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  pending: "Pending",
  inProgress: "In progress",
  stopped: "Stopped",
  canceled: "Canceled",
  completed: "Completed",
};
</script>

<template>
  <article class="task-card" :data-status="props.task.status">
    <div class="task-card-heading">
      <button class="task-title" type="button" :aria-label="`Edit task ${props.task.title}`" @click="emit('edit')">
        {{ props.task.title }}
      </button>
      <span class="task-id">#{{ props.task.id }}</span>
    </div>
    <p class="task-description">{{ props.task.description || "No description" }}</p>

    <div class="task-card-meta">
      <span class="project-name" :title="props.projectPath">{{ projectName }}</span>
      <span class="status-label" :data-status="props.task.status">{{ STATUS_LABELS[props.task.status] }}</span>
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
        :title="previousStatus ? `Move to ${STATUS_LABELS[previousStatus]}` : 'Already at the first status'"
        :disabled="previousStatus === null"
        @click="previousStatus && emit('moveStatus', previousStatus)"
      >
        <ChevronUp :size="16" aria-hidden="true" />
      </button>
      <button
        class="task-action"
        type="button"
        :aria-label="`Move ${props.task.title} to next status`"
        :title="nextStatus ? `Move to ${STATUS_LABELS[nextStatus]}` : 'Already at the last status'"
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
  flex: none;
  padding: 4px 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-size: 10px;
  font-weight: 500;
}

.status-label[data-status="inProgress"] {
  border-color: color-mix(in srgb, var(--teal) 24%, transparent);
  background: color-mix(in srgb, var(--teal) 10%, transparent);
  color: var(--teal);
}

.status-label[data-status="stopped"] {
  border-color: color-mix(in srgb, var(--amber) 24%, transparent);
  background: color-mix(in srgb, var(--amber) 10%, transparent);
  color: var(--amber);
}

.status-label[data-status="canceled"] {
  border-color: color-mix(in srgb, var(--red) 24%, transparent);
  background: color-mix(in srgb, var(--red) 10%, transparent);
  color: var(--red);
}

.status-label[data-status="completed"] {
  border-color: color-mix(in srgb, var(--blue) 24%, transparent);
  background: color-mix(in srgb, var(--blue) 10%, transparent);
  color: var(--blue);
}

.task-actions {
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
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
