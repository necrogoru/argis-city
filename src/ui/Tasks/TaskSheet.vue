<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Task } from "../../domain/types";
import { TASK_STATUS_LABELS } from "../../domain/tasks";
import { writeClipboardText } from "../../services/clipboard";
import CopyButton from "../common/CopyButton.vue";
import TaskImageRow from "./TaskImageRow.vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ task: Task; projectPath: string }>();
const emit = defineEmits<{ edit: [] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const hasDescription = computed(() => props.task.description.trim().length > 0);
let returnFocus: HTMLElement | null = null;

function show(): void {
  const element = dialog.value;
  if (!element || element.open) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  element.showModal();
}

function hide(): void {
  const element = dialog.value;
  if (element?.open) element.close();
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}

watch(
  open,
  (isOpen) => {
    if (isOpen) show();
    else hide();
  },
  { flush: "post" },
);

onMounted(() => {
  if (open.value) show();
});

onBeforeUnmount(hide);

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

function edit(): void {
  emit("edit");
}
</script>

<template>
  <dialog ref="dialog" class="task-sheet" aria-labelledby="task-sheet-title" @close="handleClose" @cancel="handleCancel">
    <header class="sheet-header">
      <div class="sheet-heading">
        <p class="sheet-eyebrow">#{{ props.task.id }} · {{ props.projectPath }}</p>
        <span class="status-label" :data-status="props.task.status">{{ TASK_STATUS_LABELS[props.task.status] }}</span>
      </div>
      <button class="icon-close" type="button" aria-label="Close task" @click="close">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <section class="sheet-body">
      <div class="sheet-title-block">
        <h2 id="task-sheet-title">{{ props.task.title }}</h2>
        <CopyButton
          label="Copy title"
          copied-label="Title copied"
          show-label
          :copy="() => writeClipboardText(props.task.title)"
        />
      </div>

      <div class="sheet-description-block">
        <p v-if="hasDescription" class="sheet-description">{{ props.task.description }}</p>
        <p v-else class="sheet-description sheet-description--empty">No description</p>
        <CopyButton
          label="Copy description"
          copied-label="Description copied"
          show-label
          :disabled="!hasDescription"
          :copy="() => writeClipboardText(props.task.description)"
        />
      </div>

      <div v-if="props.task.images.length" class="sheet-images">
        <TaskImageRow v-for="image in props.task.images" :key="image.id" :image="image" />
      </div>
    </section>

    <footer class="sheet-footer">
      <button class="secondary-button" type="button" @click="close">Close</button>
      <button class="primary-button" type="button" @click="edit">Edit task</button>
    </footer>
  </dialog>
</template>

<style scoped>
.task-sheet {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(680px, calc(100vw - 48px));
  max-width: none;
  max-height: calc(100vh - 48px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-panel);
  background: var(--bg);
  color: var(--text);
}

.task-sheet:not([open]) {
  display: none;
}

.task-sheet::backdrop {
  background: rgb(10 11 12 / 72%);
  backdrop-filter: blur(4px);
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.sheet-heading {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.sheet-eyebrow {
  margin: 0;
  overflow: hidden;
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-label {
  --status-color: var(--text-2);

  justify-self: start;
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

.icon-close {
  display: grid;
  flex: none;
  width: 40px;
  min-height: 40px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  background: var(--fill-subtle);
  color: var(--text-2);
  cursor: pointer;
}

.icon-close:hover {
  background: var(--fill-hover);
  color: var(--text);
}

.icon-close:focus-visible,
.secondary-button:focus-visible,
.primary-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.sheet-body {
  display: grid;
  gap: 22px;
  padding: 22px 24px;
  overflow: auto;
}

.sheet-title-block,
.sheet-description-block {
  display: grid;
  gap: 10px;
}

.sheet-title-block h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.sheet-description {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.sheet-description--empty {
  color: var(--text-3);
  font-style: italic;
}

.sheet-title-block :deep(.copy),
.sheet-description-block :deep(.copy) {
  justify-self: start;
}

.sheet-images {
  display: grid;
  gap: 18px;
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border);
}

.secondary-button,
.primary-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  font: inherit;
  cursor: pointer;
}

.secondary-button {
  background: var(--fill-subtle);
  color: var(--text);
}

.primary-button {
  border-color: var(--teal);
  background: var(--teal);
  color: var(--text-on-accent);
  font-weight: 500;
}

@media (width < 700px) {
  .task-sheet {
    width: calc(100vw - 24px);
    border-radius: var(--radius-card);
  }

  .sheet-header,
  .sheet-body,
  .sheet-footer {
    padding-inline: 16px;
  }
}
</style>
