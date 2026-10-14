<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Task } from "../../domain/types";
import TerminalSurface from "./TerminalSurface.vue";

type TerminalTab = "agent" | "term";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ close: [] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const closeButton = useTemplateRef<HTMLButtonElement>("close-button");
const agentTabButton = useTemplateRef<HTMLButtonElement>("agent-tab");
const termTabButton = useTemplateRef<HTMLButtonElement>("term-tab");
const activeTab = ref<TerminalTab>("agent");
const terminalReady = ref(false);
let returnFocus: HTMLElement | null = null;

function show(): void {
  const element = dialog.value;
  if (!element || element.open) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeTab.value = "agent";
  terminalReady.value = false;
  element.showModal();
  void nextTick(() => {
    if (!open.value) return;
    terminalReady.value = true;
    closeButton.value?.focus();
  });
}

function hide(): void {
  terminalReady.value = false;
  if (dialog.value?.open) dialog.value.close();
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}

function close(): void {
  if (!open.value) return;
  open.value = false;
  emit("close");
}

function handleCancel(event: Event): void {
  event.preventDefault();
  close();
}

function handleNativeClose(): void {
  if (open.value) close();
  else hide();
}

function selectTab(tab: TerminalTab): void {
  activeTab.value = tab;
}

function handleTabKeydown(event: KeyboardEvent): void {
  if (!(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(event.key)) return;
  event.preventDefault();
  const tab: TerminalTab = event.key === "Home" || (event.key === "ArrowLeft" && activeTab.value === "term")
    ? "agent"
    : event.key === "End" || (event.key === "ArrowRight" && activeTab.value === "agent")
      ? "term"
      : activeTab.value;
  activeTab.value = tab;
  void nextTick(() => (tab === "agent" ? agentTabButton.value : termTabButton.value)?.focus());
}

watch(open, (isOpen) => (isOpen ? show() : hide()), { flush: "post" });

onMounted(() => {
  if (open.value) show();
});

onBeforeUnmount(() => {
  hide();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="terminal-dialog"
    aria-labelledby="terminal-dialog-title"
    @close="handleNativeClose"
    @cancel="handleCancel"
  >
    <header class="terminal-header">
      <div class="terminal-heading">
        <p class="terminal-eyebrow">TASK #{{ props.task.id }} · TERMINAL</p>
        <h2 id="terminal-dialog-title">{{ props.task.title }}</h2>
        <p class="worktree-path">{{ props.task.worktreePath }}</p>
      </div>
      <button ref="close-button" class="close-button" type="button" aria-label="Close terminal" @click="close">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <div class="terminal-tabs" role="tablist" aria-label="Terminal sessions" @keydown="handleTabKeydown">
      <button
        id="agent-terminal-tab"
        ref="agent-tab"
        class="terminal-tab"
        type="button"
        role="tab"
        aria-controls="agent-terminal-panel"
        :aria-selected="activeTab === 'agent'"
        :tabindex="activeTab === 'agent' ? 0 : -1"
        @click="selectTab('agent')"
      >
        Agent
        <span class="tab-status">Not started</span>
      </button>
      <button
        id="term-terminal-tab"
        ref="term-tab"
        class="terminal-tab"
        type="button"
        role="tab"
        aria-controls="term-terminal-panel"
        :aria-selected="activeTab === 'term'"
        :tabindex="activeTab === 'term' ? 0 : -1"
        @click="selectTab('term')"
      >
        <code>term</code>
        <span class="tab-status">Not started</span>
      </button>
    </div>

    <div v-if="terminalReady" class="terminal-panels">
      <section
        id="agent-terminal-panel"
        class="terminal-panel"
        role="tabpanel"
        aria-labelledby="agent-terminal-tab"
        tabindex="0"
        v-show="activeTab === 'agent'"
      >
        <TerminalSurface label="Agent terminal" :active="activeTab === 'agent'" :connected="false" />
      </section>
      <section
        id="term-terminal-panel"
        class="terminal-panel"
        role="tabpanel"
        aria-labelledby="term-terminal-tab"
        tabindex="0"
        v-show="activeTab === 'term'"
      >
        <TerminalSurface label="Shell terminal" :active="activeTab === 'term'" :connected="false" />
      </section>
    </div>

    <footer class="terminal-footer">
      <span>Task workspace</span>
      <span>Close terminal to return to the board</span>
    </footer>
  </dialog>
</template>

<style scoped src="./TerminalModal.css"></style>
