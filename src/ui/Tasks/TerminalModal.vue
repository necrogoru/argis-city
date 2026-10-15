<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { X } from "@lucide/vue";
import type { Task, TerminalTab } from "../../domain/types";
import { getTerminalTabForKey, shouldStartTerminalForKey } from "../../domain/terminalNavigation";
import { useTerminalRailStore } from "../../stores/terminalRail";
import TerminalSessionPane from "./TerminalSessionPane.vue";
import type { TerminalStatus } from "./useTerminalSession";

interface TerminalPaneHandle {
  reattach: () => Promise<void>;
  detach: () => Promise<void>;
  fit: () => void;
  focus: () => void;
  start: () => Promise<void>;
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
const terminalRail = useTerminalRailStore();
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

async function focusTab(tab: TerminalTab): Promise<void> {
  await nextTick();
  if (!open.value || activeTab.value !== tab) return;
  const pane = tab === "agent" ? agentPane.value : termPane.value;
  pane?.fit();
  pane?.focus();
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
      if (open.value) {
        await restoreSessions();
        await focusTab("agent");
      }
    } else {
      agentPane.value?.fit();
      termPane.value?.fit();
      await focusTab("agent");
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
  const tab = getTerminalTabForKey(activeTab.value, event);
  if (!tab) return;
  selectTab(tab);
  void nextTick(() => (tab === "agent" ? agentTabButton.value : termTabButton.value)?.focus());
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const isTerminalInput = Boolean(target?.closest(".xterm-helper-textarea"));
  const isOtherEditable = Boolean(
    target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
  const activeStatus = activeTab.value === "agent" ? agentStatus.value : termStatus.value;
  const canStart = !restoring.value && activeStatus !== "running" && activeStatus !== "starting";

  if ((!isOtherEditable || isTerminalInput) && shouldStartTerminalForKey(event, canStart)) {
    event.preventDefault();
    event.stopPropagation();
    const pane = activeTab.value === "agent" ? agentPane.value : termPane.value;
    void pane?.start();
    return;
  }

  if (event.key !== "Tab") return;
  const tab = getTerminalTabForKey(activeTab.value, event);
  if (!tab) return;
  event.preventDefault();
  event.stopPropagation();
  selectTab(tab);
  void focusTab(tab);
}

watch(open, (isOpen) => (isOpen ? show() : hide()), { flush: "post" });

onMounted(() => {
  if (open.value) show();
});

onBeforeUnmount(() => {
  terminalRail.clearTaskStatus(props.task.id);
  hide();
});

watch(agentStatus, (status) => terminalRail.publishTaskStatus(props.task.id, "agent", status), { immediate: true });
watch(termStatus, (status) => terminalRail.publishTaskStatus(props.task.id, "term", status), { immediate: true });
</script>

<template>
  <dialog
    ref="dialog"
    class="terminal-dialog"
    aria-labelledby="terminal-dialog-title"
    @close="handleNativeClose"
    @cancel="handleCancel"
    @keydown.capture="handleDialogKeydown"
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
