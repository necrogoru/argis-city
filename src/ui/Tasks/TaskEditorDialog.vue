<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { FileDropEvent, Project, Task, TaskDeletionOutcome } from "../../domain/types";
import { useAgentSource } from "../../composables/useAgentSource";
import { useTaskImageAttachments } from "../../composables/useTaskImageAttachments";
import { useTaskStore } from "../../stores/tasks";
import TaskImagePreview from "./TaskImagePreview.vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ projects: Project[]; task: Task | null }>();
const emit = defineEmits<{ deleted: [outcome: TaskDeletionOutcome] }>();
const store = useTaskStore();
const source = useAgentSource();
const attachments = useTaskImageAttachments();
const { staged, keptIds, error: attachmentError, dragActive } = attachments;
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const fileInput = useTemplateRef<HTMLInputElement>("file-input");
const title = ref("");
const description = ref("");
const projectId = ref<number | null>(null);
const saving = ref(false);
const deleting = ref(false);
const removeGitResources = ref(false);
const hasGitResources = computed(() => props.task?.branchName != null || props.task?.worktreePath != null);
const taskImages = computed(() => props.task?.images ?? []);
const existingImages = computed(() => taskImages.value.filter((image) => keptIds.value.includes(image.id)));
let unsubscribeDrop: (() => void) | null = null;

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
    attachments.reset();
    keptIds.value = taskImages.value.map((image) => image.id);
    unsubscribeDrop = source.subscribeFileDrop(handleFileDrop);
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.querySelector<HTMLInputElement>("input[type=text]")?.focus();
    onCleanup(() => {
      unsubscribeDrop?.();
      unsubscribeDrop = null;
      attachments.reset();
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

function handlePaste(event: ClipboardEvent): void {
  const files = event.clipboardData?.files;
  if (files?.length) {
    event.preventDefault();
    void attachments.addFiles(files, taskImages.value);
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target && !target.closest("input, textarea, [contenteditable='true']")) {
    attachmentError.value = "Only PNG, JPEG, WebP, and GIF images can be attached.";
  }
}

function handleDrop(event: DragEvent): void {
  dragActive.value = false;
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  void attachments.addFiles(files, taskImages.value);
}

function handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) void attachments.addFiles(input.files, taskImages.value);
  input.value = "";
}

function chooseFiles(): void {
  fileInput.value?.click();
}

function handleFileDrop(event: FileDropEvent): void {
  dragActive.value = event.type === "enter";
  if (event.type === "drop") void attachments.addPaths(event.paths, taskImages.value);
}

async function save(): Promise<void> {
  const taskTitle = title.value.trim();
  if (!taskTitle) return;
  saving.value = true;
  try {
    const images = attachments.inputs(taskImages.value);
    const result = props.task
      ? await store.updateTaskDetails(props.task.id, taskTitle, description.value.trim(), images)
      : projectId.value == null
        ? null
        : await store.createTask(projectId.value, taskTitle, description.value.trim(), images);
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
  <dialog
    ref="dialog"
    class="task-dialog"
    aria-labelledby="task-dialog-title"
    @close="handleClose"
    @cancel="handleCancel"
    @paste="handlePaste"
    @dragover.prevent="dragActive = true"
    @dragleave="dragActive = false"
    @drop.prevent="handleDrop"
  >
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

      <div class="task-images">
        <span class="images-label">Images</span>
        <button
          class="drop-zone"
          :class="{ 'drop-zone--active': dragActive }"
          type="button"
          @click="chooseFiles"
        >
          <span>{{ dragActive ? "Drop to attach to this task" : "Drop, paste, or choose images" }}</span>
          <span class="drop-hint">PNG, JPEG, WebP, or GIF · up to 12 images, 10 MB each, 30 MB total</span>
        </button>
        <input
          ref="file-input"
          class="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          @change="handleFileInput"
        />
        <ul v-if="existingImages.length || staged.length" class="image-grid">
          <li v-for="image in existingImages" :key="`existing-${image.id}`" class="image-tile">
            <TaskImagePreview :image="image" />
            <button
              class="remove-image"
              type="button"
              :aria-label="`Remove ${image.fileName}`"
              @click="attachments.removeExisting(image.id)"
            >
              <X :size="14" aria-hidden="true" />
            </button>
          </li>
          <li v-for="(image, index) in staged" :key="`staged-${index}`" class="image-tile">
            <img :src="image.previewUrl" :alt="image.fileName" />
            <button
              class="remove-image"
              type="button"
              :aria-label="`Remove ${image.fileName}`"
              @click="attachments.removeStaged(index)"
            >
              <X :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p v-if="attachmentError" class="form-error" role="alert">{{ attachmentError }}</p>
      </div>

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
      <p class="delete-copy">
        Any active Agent or shell sessions will stop before deletion. If Argis cannot stop them, the task and any worktree will remain.
      </p>
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

.task-images {
  display: grid;
  gap: 10px;
}

.images-label {
  color: var(--text-2);
  font-size: 12px;
}

.drop-zone {
  display: grid;
  gap: 4px;
  padding: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease;
}

.drop-zone:hover,
.drop-zone--active {
  border-color: var(--teal);
  color: var(--teal);
}

.drop-zone:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.drop-hint {
  color: var(--text-3);
  font-size: 11px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 88px));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.image-tile {
  position: relative;
  width: 88px;
  height: 88px;
}

.image-tile > img,
.image-tile :deep(.task-image-preview),
.image-tile :deep(.task-image-placeholder) {
  box-sizing: border-box;
  width: 88px;
  height: 88px;
  max-height: none;
  border-radius: var(--radius-card);
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--fill-subtle);
  color: var(--text-2);
  cursor: pointer;
}

.remove-image:hover {
  color: var(--text);
}

.remove-image:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.file-input {
  display: none;
}
</style>
