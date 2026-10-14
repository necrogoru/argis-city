<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Task, TerminalTab } from "../../domain/types";
import TerminalSessionPane from "./TerminalSessionPane.vue";
import type { TerminalStatus } from "./useTerminalSession";

interface TerminalPaneHandle {
  reattach: () => Promise<void>;
  detach: () => Promise<void>;
  fit: () => void;
}

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ close: [] }>();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const closeButton = useTemplateRef<HTMLButtonElement>("close-button");
const agentTabButton = useTemplateRef<HTMLButtonElement>("agent-tab");
const termTabButton = useTemplateRef<HTMLButtonElement>("term-tab");
const agentPane = useTemplateRef<TerminalPaneHandle>("agent-pane");
const termPane = useTemplateRef<TerminalPaneHandle>("term-pane");
const activeTab = ref<TerminalTab>("agent");
const terminalReady = ref(false);
const restoring = ref(false);
const agentStatus = ref<TerminalStatus>("notStarted");
const termStatus = ref<TerminalStatus>("notStarted");
let returnFocus: HTMLElement | null = null;

function statusLabel(status: TerminalStatus): string {
  switch (status) {
    case "notStarted": return "Not started";
    case "starting": return "Starting";
    case "running": return "Running";
    case "exited": return "Exited";
    case "error": return "Unavailable";
  }
}

async function restoreSessions(): Promise<void> {
  restoring.value = true;
  await Promise.all([agentPane.value?.reattach(), termPane.value?.reattach()]);
  restoring.value = false;
}

function show(): void {
  const element = dialog.value;
  if (!element || element.open) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const firstOpen = !terminalReady.value;
  activeTab.value = "agent";
  element.showModal();
  void nextTick(async () => {
    if (!open.value) return;
    closeButton.value?.focus();
    if (firstOpen) {
      terminalReady.value = true;
      await nextTick();
      if (open.value) await restoreSessions();
    } else {
      agentPane.value?.fit();
      termPane.value?.fit();
    }
  });
}

function hide(): void {
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
  selectTab(tab);
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
        <span class="tab-status">{{ statusLabel(agentStatus) }}</span>
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
        <span class="tab-status">{{ statusLabel(termStatus) }}</span>
      </button>
    </div>

    <div v-if="terminalReady" class="terminal-panels">
      <TerminalSessionPane
        ref="agent-pane"
        :task-id="props.task.id"
        tab="agent"
        :active="open && activeTab === 'agent'"
        :restoring="restoring"
        panel-id="agent-terminal-panel"
        tab-id="agent-terminal-tab"
        @status-change="agentStatus = $event"
      />
      <TerminalSessionPane
        ref="term-pane"
        :task-id="props.task.id"
        tab="term"
        :active="open && activeTab === 'term'"
        :restoring="restoring"
        panel-id="term-terminal-panel"
        tab-id="term-terminal-tab"
        @status-change="termStatus = $event"
      />
    </div>

    <footer class="terminal-footer">
      <span>Task workspace</span>
      <span>Close terminal to return to the board</span>
    </footer>
  </dialog>
</template>

<style scoped src="./TerminalModal.css"></style>
