<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, taskStatusForShortcut } from "../../domain/tasks";
import type { Task, TaskStatus } from "../../domain/types";
import Kbd from "../common/Kbd.vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ task: Task | null }>();
const emit = defineEmits<{ select: [status: TaskStatus] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");

watch(
  open,
  (isOpen, _previous, onCleanup) => {
    const element = dialog.value;
    if (!element || !isOpen || !props.task) return;

    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    void nextTick(() => {
      const current = element.querySelector<HTMLButtonElement>('[data-current="true"]');
      (current ?? element.querySelector<HTMLButtonElement>(".status-option"))?.focus();
    });
    onCleanup(() => {
      if (element.open) element.close();
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

function handleKeydown(event: KeyboardEvent): void {
  const status = taskStatusForShortcut(event);
  if (!status || !props.task) return;

  event.preventDefault();
  event.stopPropagation();
  emit("select", status);
}
</script>

<template>
  <dialog
    ref="dialog"
    class="status-dialog"
    aria-labelledby="status-dialog-title"
    aria-describedby="status-dialog-hint"
    aria-keyshortcuts="1 2 3 4 5"
    @close="handleClose"
    @cancel="handleCancel"
    @keydown.capture="handleKeydown"
  >
    <header class="dialog-header">
      <div>
        <h2 id="status-dialog-title">Change status</h2>
        <p v-if="props.task">Task #{{ props.task.id }} · {{ props.task.title }}</p>
      </div>
      <button class="icon-close" type="button" aria-label="Close status picker" @click="close">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <ul v-if="props.task" class="status-options" aria-label="Available task statuses">
      <li v-for="(status, index) in TASK_STATUS_ORDER" :key="status">
        <button
          class="status-option"
          :data-current="props.task.status === status"
          :aria-current="props.task.status === status ? 'true' : undefined"
          :aria-keyshortcuts="String(index + 1)"
          type="button"
          @click="emit('select', status)"
        >
          <Kbd>{{ index + 1 }}</Kbd>
          <span class="status-name">{{ TASK_STATUS_LABELS[status] }}</span>
          <span v-if="props.task.status === status" class="current-status">Current</span>
        </button>
      </li>
    </ul>

    <footer id="status-dialog-hint" class="dialog-hint">
      <span><Kbd>1–5</Kbd> choose status</span>
      <span><Kbd>Esc</Kbd> cancel</span>
    </footer>
  </dialog>
</template>

<style scoped>
.status-dialog {
  box-sizing: border-box;
  width: min(440px, calc(100vw - 48px));
  max-width: none;
  margin: auto;
  padding: 22px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-panel);
  background: var(--bg);
  color: var(--text);
}

.status-dialog::backdrop {
  background: rgb(10 11 12 / 72%);
  backdrop-filter: blur(4px);
}

.dialog-header,
.status-option,
.dialog-hint {
  display: flex;
  align-items: center;
}

.dialog-header {
  justify-content: space-between;
  gap: 16px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.dialog-header p {
  max-width: 320px;
  margin: 6px 0 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-close {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  background: var(--fill-subtle);
  color: var(--text-2);
  cursor: pointer;
}

.status-options {
  display: grid;
  gap: 6px;
  margin: 18px 0 14px;
  padding: 0;
  list-style: none;
}

.status-option {
  box-sizing: border-box;
  width: 100%;
  min-height: 46px;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.status-option:hover {
  border-color: var(--border-strong);
  background: var(--fill-hover);
}

.status-option[data-current="true"] {
  border-color: color-mix(in srgb, var(--teal) 48%, transparent);
}

.status-name {
  flex: 1;
  font-size: 13px;
}

.current-status {
  color: var(--teal);
  font-size: 11px;
}

.dialog-hint {
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--text-2);
  font-size: 11px;
}

.dialog-hint span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.icon-close:focus-visible,
.status-option:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}
</style>
