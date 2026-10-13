<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Project, Task, TaskDeletionOutcome } from "../../domain/types";
import { useTaskStore } from "../../stores/tasks";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ projects: Project[]; task: Task | null }>();
const emit = defineEmits<{ deleted: [outcome: TaskDeletionOutcome] }>();
const store = useTaskStore();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const title = ref("");
const description = ref("");
const projectId = ref<number | null>(null);
const saving = ref(false);
const deleting = ref(false);
const removeGitResources = ref(false);
const hasGitResources = computed(() => props.task?.branchName != null || props.task?.worktreePath != null);

const selectedProjectId = computed({
  get: () => (projectId.value == null ? "" : String(projectId.value)),
  set: (value: string) => {
    projectId.value = value ? Number(value) : null;
  },
});

watch(
  open,
  (isOpen, _previous, onCleanup) => {
    const element = dialog.value;
    if (!element || !isOpen) return;
    title.value = props.task?.title ?? "";
    description.value = props.task?.description ?? "";
    projectId.value = props.task?.projectId ?? props.projects[0]?.id ?? null;
    deleting.value = false;
    removeGitResources.value = false;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.querySelector<HTMLInputElement>("input[type=text]")?.focus();
    onCleanup(() => {
      element.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  },
  { flush: "post" },
);

function close(): void {
  open.value = false;
}

function handleClose(): void {
  if (!dialog.value?.open) close();
}

function handleCancel(event: Event): void {
  event.preventDefault();
  close();
}

async function save(): Promise<void> {
  const taskTitle = title.value.trim();
  if (!taskTitle) return;
  saving.value = true;
  try {
    const result = props.task
      ? await store.updateTaskDetails(props.task.id, taskTitle, description.value.trim())
      : projectId.value == null
        ? null
        : await store.createTask(projectId.value, taskTitle, description.value.trim());
    if (result) close();
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (!props.task) return;
  saving.value = true;
  try {
    const outcome = await store.deleteTask(props.task.id, removeGitResources.value);
    if (!outcome?.taskDeleted) return;
    emit("deleted", outcome);
    close();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="task-dialog" aria-labelledby="task-dialog-title" @close="handleClose" @cancel="handleCancel">
    <header class="dialog-header">
      <div>
        <h2 id="task-dialog-title">
          {{ deleting ? "Delete task?" : props.task ? "Edit task" : "New task" }}
        </h2>
        <p v-if="deleting">This removes the task record from Argis.</p>
        <p v-else>{{ props.task ? `ID ${props.task.id} stays with this task.` : "Tasks start in Pending." }}</p>
      </div>
      <button class="icon-close" type="button" aria-label="Close task editor" @click="close">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <form v-if="!deleting" class="task-form" @submit.prevent="save">
      <label for="task-title">Task name</label>
      <input id="task-title" v-model="title" type="text" maxlength="160" autocomplete="off" required />

      <label for="task-description">Description</label>
      <textarea id="task-description" v-model="description" rows="4" maxlength="2000" />

      <template v-if="!props.task">
        <label for="task-project">Project</label>
        <select id="task-project" v-model="selectedProjectId" required>
          <option disabled value="">Choose a project</option>
          <option v-for="project in props.projects" :key="project.id" :value="String(project.id)">
            {{ project.path.split(/[\\/]/).filter(Boolean).at(-1) }}
          </option>
        </select>
      </template>
      <p v-else class="project-readonly">
        Project: {{ props.projects.find((project) => project.id === props.task?.projectId)?.path ?? "Unavailable" }}
      </p>

      <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>
      <div class="form-actions">
        <button v-if="props.task" class="delete-link" type="button" @click="deleting = true">Delete task</button>
        <button class="secondary-button" type="button" @click="close">Cancel</button>
        <button class="primary-button" type="submit" :disabled="saving || !title.trim() || (!props.task && projectId == null)">
          {{ saving ? "Saving…" : props.task ? "Save changes" : "Create task" }}
        </button>
      </div>
    </form>
    <section v-else class="delete-confirmation" aria-labelledby="task-dialog-title">
      <p v-if="hasGitResources" class="delete-copy">
        Keep the Git workspace, or ask Argis to remove its branch and worktree directory too.
      </p>
      <p v-else class="delete-copy">This task has no Git branch or worktree to clean up.</p>
      <label v-if="hasGitResources" class="checkbox-row">
        <input v-model="removeGitResources" type="checkbox" />
        <span>Also delete the branch and worktree directory</span>
      </label>
      <p v-if="hasGitResources && removeGitResources" class="cleanup-note">
        Argis will not force-remove a worktree with uncommitted changes. The task will still be deleted and any remaining Git paths will be reported.
      </p>
      <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>
      <div class="form-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="deleting = false">Keep task</button>
        <button class="danger-button" type="button" :disabled="saving" @click="confirmDelete">
          {{ saving ? "Deleting…" : "Delete task" }}
        </button>
      </div>
    </section>
  </dialog>
</template>

<style scoped>
.task-dialog {
  box-sizing: border-box;
  width: min(560px, calc(100vw - 48px));
  max-width: none;
  max-height: calc(100vh - 48px);
  margin: auto;
  padding: 24px;
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-panel);
  background: var(--bg);
  color: var(--text);
}

.task-dialog::backdrop {
  background: rgb(10 11 12 / 72%);
  backdrop-filter: blur(4px);
}

.dialog-header,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.dialog-header p,
.project-readonly {
  margin: 6px 0 0;
  color: var(--text-2);
  font-size: 13px;
}

.icon-close,
.primary-button,
.secondary-button,
.danger-button {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  font: inherit;
  cursor: pointer;
}

.icon-close {
  width: 40px;
  color: var(--text-2);
  background: var(--fill-subtle);
}

.delete-link {
  margin-right: auto;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--red);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.task-form {
  display: grid;
  gap: 10px;
  margin-top: 24px;
}

.task-form > label {
  color: var(--text-2);
  font-size: 12px;
}

.task-form input,
.task-form textarea,
.task-form select {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--fill-subtle);
  color: var(--text);
  font: inherit;
}

.task-form textarea {
  resize: vertical;
}

.task-form input:focus-visible,
.task-form textarea:focus-visible,
.task-form select:focus-visible,
.icon-close:focus-visible,
.delete-link:focus-visible,
.primary-button:focus-visible,
.secondary-button:focus-visible,
.danger-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.project-readonly {
  overflow-wrap: anywhere;
}

.form-error {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}

.delete-confirmation {
  display: grid;
  gap: 14px;
  margin-top: 24px;
}

.delete-copy,
.cleanup-note {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.45;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text);
  font-size: 13px;
}

.checkbox-row input {
  accent-color: var(--teal);
}

.cleanup-note {
  color: var(--amber);
}

.form-actions {
  justify-content: flex-end;
  margin-top: 8px;
}

.primary-button,
.secondary-button,
.danger-button {
  padding: 0 16px;
}

.primary-button {
  border-color: var(--teal);
  background: var(--teal);
  color: var(--text-on-accent);
  font-weight: 500;
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-button {
  background: var(--fill-subtle);
  color: var(--text);
}

.danger-button {
  border-color: color-mix(in srgb, var(--red) 45%, transparent);
  background: color-mix(in srgb, var(--red) 14%, transparent);
  color: var(--red);
}

.secondary-button:disabled,
.danger-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
