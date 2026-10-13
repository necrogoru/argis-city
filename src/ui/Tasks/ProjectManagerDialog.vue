<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Project } from "../../domain/types";
import { useTaskStore } from "../../stores/tasks";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ projects: Project[] }>();
const store = useTaskStore();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const path = ref("");
const createIfMissing = ref(false);

watch(
  open,
  (isOpen, _previous, onCleanup) => {
    const element = dialog.value;
    if (!element || !isOpen) return;
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

function projectName(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? projectPath;
}

async function addProject(): Promise<void> {
  const value = path.value.trim();
  if (!value) return;
  const project = await store.addProject(value, createIfMissing.value);
  if (project) {
    path.value = "";
    createIfMissing.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="project-dialog" aria-labelledby="project-dialog-title" @close="handleClose" @cancel="handleCancel">
    <header class="dialog-header">
      <div>
        <h2 id="project-dialog-title">Projects</h2>
        <p>Choose a local project folder for your tasks.</p>
      </div>
      <button class="icon-close" type="button" aria-label="Close projects" @click="close">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <ul v-if="props.projects.length" class="project-list" aria-label="Registered projects">
      <li v-for="project in props.projects" :key="project.id" class="project-row">
        <span class="project-name">{{ projectName(project.path) }}</span>
        <code>{{ project.path }}</code>
      </li>
    </ul>
    <p v-else class="empty-projects">No projects yet. Add a folder path below to get started.</p>

    <form class="project-form" @submit.prevent="addProject">
      <label for="project-path">Directory path</label>
      <input id="project-path" v-model="path" type="text" placeholder="/Users/you/projects/my-app" autocomplete="off" required />
      <label class="checkbox-row" for="create-project-directory">
        <input id="create-project-directory" v-model="createIfMissing" type="checkbox" />
        <span>Create the directory if it doesn’t exist</span>
      </label>
      <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>
      <div class="form-actions">
        <button class="secondary-button" type="button" @click="close">Done</button>
        <button class="primary-button" type="submit" :disabled="!path.trim()">Add project</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.project-dialog {
  box-sizing: border-box;
  width: min(620px, calc(100vw - 48px));
  max-width: none;
  max-height: min(720px, calc(100vh - 48px));
  margin: auto;
  padding: 24px;
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-panel);
  background: var(--bg);
  color: var(--text);
}

.project-dialog::backdrop {
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
.empty-projects {
  margin: 6px 0 0;
  color: var(--text-2);
  font-size: 13px;
}

.icon-close,
.primary-button,
.secondary-button {
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
  font-size: 22px;
}

.project-list {
  display: grid;
  gap: 8px;
  max-height: 260px;
  margin: 24px 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.project-row {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
}

.project-name {
  font-size: 14px;
  font-weight: 500;
}

.project-row code {
  overflow-wrap: anywhere;
  color: var(--text-3);
  font: 12px var(--font);
}

.project-form {
  display: grid;
  gap: 10px;
  margin-top: 24px;
}

.project-form > label:first-child {
  font-size: 12px;
  color: var(--text-2);
}

.project-form input[type="text"] {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--fill-subtle);
  color: var(--text);
  font: inherit;
}

.project-form input:focus-visible,
.icon-close:focus-visible,
.primary-button:focus-visible,
.secondary-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text-2);
  font-size: 13px;
}

.checkbox-row input {
  accent-color: var(--teal);
}

.form-error {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}

.form-actions {
  justify-content: flex-end;
  margin-top: 8px;
}

.primary-button,
.secondary-button {
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
</style>
