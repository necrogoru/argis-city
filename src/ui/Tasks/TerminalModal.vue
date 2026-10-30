<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { Plus, X } from "@lucide/vue";
import type { Task, TerminalInventoryEntry, TerminalTab } from "../../domain/types";
import {
  AGENT_TAB,
  BASE_SHELL_TAB,
  BASE_TERMINAL_TABS,
  isShellTab,
  mergeTerminalTabs,
  nextShellTab,
  sortTerminalTabs,
  terminalTabLabel,
} from "../../domain/terminalTabs";
import {
  DEFAULT_TERMINAL_TAB,
  getTerminalTabForKey,
  shouldCloseTerminalModalForKey,
  shouldStartTerminalForKey,
} from "../../domain/terminalNavigation";
import { useAgentSource } from "../../composables/useAgentSource";
import { useTerminalRailStore } from "../../stores/terminalRail";
import TerminalSessionPane from "./TerminalSessionPane.vue";
import type { TerminalStatus } from "./useTerminalSession";

interface TerminalPaneHandle {
  reattach: () => Promise<void>;
  detach: () => Promise<void>;
  fit: () => void;
  focus: () => void;
  refresh: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ close: [] }>();
const source = useAgentSource();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const closeButton = useTemplateRef<HTMLButtonElement>("close-button");
const tabs = ref<TerminalTab[]>([...BASE_TERMINAL_TABS]);
const activeTab = ref<TerminalTab>(DEFAULT_TERMINAL_TAB);
const terminalReady = ref(false);
const restoring = ref(false);
const statuses = ref<Partial<Record<TerminalTab, TerminalStatus>>>({});
const panes = new Map<TerminalTab, TerminalPaneHandle>();
const terminalRail = useTerminalRailStore();
let returnFocus: HTMLElement | null = null;

const canAddTab = computed(() => nextShellTab(tabs.value) !== null);

function statusLabel(status: TerminalStatus): string {
  switch (status) {
    case "notStarted": return "Not started";
    case "starting": return "Starting";
    case "running": return "Running";
    case "exited": return "Exited";
    case "error": return "Unavailable";
  }
}

function statusFor(tab: TerminalTab): TerminalStatus {
  return statuses.value[tab] ?? "notStarted";
}

function setPane(tab: TerminalTab, pane: unknown): void {
  if (pane) panes.set(tab, pane as TerminalPaneHandle);
  else panes.delete(tab);
}

function paneFor(tab: TerminalTab): TerminalPaneHandle | undefined {
  return panes.get(tab);
}

function tabButtonFor(tab: TerminalTab): HTMLElement | null {
  return dialog.value?.querySelector<HTMLElement>(`[data-terminal-tab="${tab}"]`) ?? null;
}

/** Adds tabs for shells the backend still owns, e.g. after switching tasks or reloading the frontend. */
async function restoreTabsFromInventory(): Promise<TerminalTab[]> {
  let inventory: TerminalInventoryEntry[];
  try {
    inventory = await source.listTerminalInventory();
  } catch {
    return [];
  }
  const known = new Set(tabs.value);
  const backendTabs = inventory
    .filter((entry) => entry.taskId === props.task.id && isShellTab(entry.tab))
    .map((entry) => entry.tab);
  const merged = mergeTerminalTabs(tabs.value, backendTabs);
  const added = merged.filter((tab) => !known.has(tab));
  if (added.length > 0) tabs.value = merged;
  return added;
}

async function restoreSessions(): Promise<void> {
  restoring.value = true;
  await Promise.all(tabs.value.map((tab) => paneFor(tab)?.reattach()));
  restoring.value = false;
}

async function focusTab(tab: TerminalTab): Promise<void> {
  await nextTick();
  if (!open.value || activeTab.value !== tab) return;
  const pane = paneFor(tab);
  pane?.fit();
  pane?.refresh();
  pane?.focus();
}

async function show(): Promise<void> {
  const element = dialog.value;
  if (!element || element.open) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const firstOpen = !terminalReady.value;
  activeTab.value = DEFAULT_TERMINAL_TAB;
  element.showModal();
  await nextTick();
  if (!open.value) return;
  closeButton.value?.focus();
  void revealTab(DEFAULT_TERMINAL_TAB);
  const added = await restoreTabsFromInventory();
  if (!open.value) return;
  if (firstOpen) {
    terminalReady.value = true;
    await nextTick();
    if (!open.value) return;
    await restoreSessions();
  } else if (added.length > 0) {
    await nextTick();
    if (!open.value) return;
    await Promise.all(added.map((tab) => paneFor(tab)?.reattach()));
  }
  if (open.value) await focusTab(DEFAULT_TERMINAL_TAB);
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
  const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
  if (activeElement?.closest(".xterm-helper-textarea")) return;
  close();
}

function handleNativeClose(): void {
  if (open.value) close();
  else hide();
}

function selectTab(tab: TerminalTab): void {
  if (!tabs.value.includes(tab)) return;
  activeTab.value = tab;
  void revealTab(tab);
}

async function revealTab(tab: TerminalTab): Promise<void> {
  await nextTick();
  tabButtonFor(tab)?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function focusTabButton(tab: TerminalTab): void {
  void nextTick(() => tabButtonFor(tab)?.focus());
}

function handleTabKeydown(event: KeyboardEvent): void {
  if (!(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(event.key)) return;
  event.preventDefault();
  const tab = getTerminalTabForKey(tabs.value, activeTab.value, event);
  if (!tab) return;
  selectTab(tab);
  focusTabButton(tab);
}

async function addShellTab(): Promise<void> {
  const tab = nextShellTab(tabs.value);
  if (!tab) return;
  tabs.value = sortTerminalTabs([...tabs.value, tab]);
  selectTab(tab);
  await nextTick();
  if (!open.value) return;
  const pane = paneFor(tab);
  pane?.fit();
  await pane?.start();
  await focusTab(tab);
}

async function closeTab(tab: TerminalTab): Promise<void> {
  if (!isShellTab(tab) || tab === BASE_SHELL_TAB) return;
  const index = tabs.value.indexOf(tab);
  if (index < 0) return;
  const fallback = tabs.value[index - 1] ?? AGENT_TAB;
  const pane = paneFor(tab);
  tabs.value = tabs.value.filter((candidate) => candidate !== tab);
  const nextStatuses = { ...statuses.value };
  delete nextStatuses[tab];
  statuses.value = nextStatuses;
  terminalRail.clearTaskTabStatus(props.task.id, tab);
  // Start the stop before the pane unmounts; otherwise its dispose() clears the attachment first.
  void pane?.stop();
  if (activeTab.value === tab) {
    selectTab(fallback);
    await nextTick();
    await focusTab(fallback);
  } else {
    focusTabButton(activeTab.value);
  }
}

function handleStatusChange(tab: TerminalTab, status: TerminalStatus): void {
  statuses.value = { ...statuses.value, [tab]: status };
  terminalRail.publishTaskStatus(props.task.id, tab, status);
}

function handleDialogKeydown(event: KeyboardEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const isTerminalInput = Boolean(target?.closest(".xterm-helper-textarea"));

  if (shouldCloseTerminalModalForKey(event, isTerminalInput)) {
    event.preventDefault();
    event.stopPropagation();
    close();
    return;
  }

  const isOtherEditable = Boolean(
    target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
  const activeStatus = statusFor(activeTab.value);
  const canStart = !restoring.value && activeStatus !== "running" && activeStatus !== "starting";

  if ((!isOtherEditable || isTerminalInput) && shouldStartTerminalForKey(event, canStart)) {
    event.preventDefault();
    event.stopPropagation();
    void paneFor(activeTab.value)?.start();
    return;
  }

  if (event.key !== "Tab") return;
  const tab = getTerminalTabForKey(tabs.value, activeTab.value, event);
  if (!tab) return;
  event.preventDefault();
  event.stopPropagation();
  selectTab(tab);
  void focusTab(tab);
}

watch(open, (isOpen) => {
  if (isOpen) void show();
  else hide();
}, { flush: "post" });

onMounted(() => {
  if (open.value) void show();
});

onBeforeUnmount(() => {
  terminalRail.clearTaskStatus(props.task.id);
  hide();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="terminal-dialog"
    aria-labelledby="terminal-dialog-title"
    aria-describedby="terminal-dialog-shortcuts"
    aria-keyshortcuts="Escape Control+Escape"
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

    <div class="terminal-tabbar">
      <div class="terminal-tabs" role="tablist" aria-label="Terminal sessions" @keydown="handleTabKeydown">
        <div v-for="tab in tabs" :key="tab" class="terminal-tab-slot" role="presentation">
          <button
            :id="`${tab}-terminal-tab`"
            class="terminal-tab"
            :class="{ 'is-closable': isShellTab(tab) && tab !== BASE_SHELL_TAB }"
            type="button"
            role="tab"
            :data-terminal-tab="tab"
            :aria-controls="`${tab}-terminal-panel`"
            :aria-selected="activeTab === tab"
            :tabindex="activeTab === tab ? 0 : -1"
            @click="selectTab(tab)"
          >
            <code v-if="isShellTab(tab)">{{ terminalTabLabel(tab) }}</code>
            <template v-else>Agent</template>
            <span class="tab-status">{{ statusLabel(statusFor(tab)) }}</span>
          </button>
          <button
            v-if="isShellTab(tab) && tab !== BASE_SHELL_TAB"
            class="terminal-tab-close"
            type="button"
            :aria-label="`Close ${terminalTabLabel(tab)}`"
            :title="`Close ${terminalTabLabel(tab)}`"
            @click="closeTab(tab)"
          >
            <X :size="12" aria-hidden="true" />
          </button>
        </div>
      </div>
      <button
        class="terminal-new-tab"
        type="button"
        aria-label="New shell tab"
        :title="canAddTab ? 'New shell tab' : 'Maximum of 6 shell tabs'"
        :disabled="!canAddTab"
        @click="addShellTab"
      >
        <Plus :size="16" aria-hidden="true" />
      </button>
    </div>

    <div v-if="terminalReady" class="terminal-panels">
      <TerminalSessionPane
        v-for="tab in tabs"
        :key="tab"
        :ref="(pane) => setPane(tab, pane)"
        :task-id="props.task.id"
        :tab="tab"
        :active="open && activeTab === tab"
        :restoring="restoring"
        :panel-id="`${tab}-terminal-panel`"
        :tab-id="`${tab}-terminal-tab`"
        @status-change="handleStatusChange(tab, $event)"
      />
    </div>

    <footer class="terminal-footer">
      <span>Task workspace</span>
      <span id="terminal-dialog-shortcuts">Ctrl+Tab cycles · Ctrl+Esc closes · Escape goes to terminal when focused</span>
    </footer>
  </dialog>
</template>

<style scoped src="./TerminalModal.css"></style>
