<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { nextVisibleTaskId } from "../domain/taskFocus";
import {
  filterInProgressTerminalRailEntries,
  terminalRailNavigationDirection,
  terminalRailStateLabel,
  terminalRailTitlePreview,
} from "../domain/terminalRail";
import { useTaskStore } from "../stores/tasks";
import { useTerminalNavigationStore } from "../stores/terminalNavigation";
import { useTerminalRailStore } from "../stores/terminalRail";

const props = defineProps<{ dashboardVisible: boolean }>();

const taskStore = useTaskStore();
const terminalNavigation = useTerminalNavigationStore();
const terminalRail = useTerminalRailStore();
const { entries } = storeToRefs(terminalRail);
const expandedTaskId = ref<number | null>(null);
let intervalId: number | null = null;

const visibleEntries = computed(() => filterInProgressTerminalRailEntries(entries.value, taskStore.tasks));

function railTint(state: (typeof entries.value)[number]["state"]): string {
  switch (state) {
    case "running": return "var(--teal)";
    case "pending": return "var(--amber)";
    case "completed": return "var(--blue)";
    case "unavailable": return "var(--red)";
    case "idle": return "var(--grey)";
  }
}

function openAgentTab(taskId: number): void {
  terminalNavigation.openTaskTerminal(taskId);
}

function setExpanded(taskId: number | null): void {
  expandedTaskId.value = taskId;
}

function clearExpanded(taskId: number): void {
  if (expandedTaskId.value === taskId) expandedTaskId.value = null;
}

function handleRailKeydown(event: KeyboardEvent): void {
  const rail = event.currentTarget;
  if (!(rail instanceof HTMLElement)) return;

  const target = event.target instanceof Element ? event.target : null;
  const launcher = target?.closest<HTMLButtonElement>(".rail-button") ?? null;
  if (!launcher || !rail.contains(launcher)) return;

  const direction = terminalRailNavigationDirection(event, true);
  if (!direction) return;

  const currentTaskId = Number(launcher.dataset.taskId);
  const nextTaskId = nextVisibleTaskId(
    visibleEntries.value.map((entry) => entry.taskId),
    currentTaskId,
    direction,
  );
  if (nextTaskId == null) return;

  const nextLauncher = Array.from(rail.querySelectorAll<HTMLButtonElement>(".rail-button"))
    .find((button) => Number(button.dataset.taskId) === nextTaskId);
  if (!nextLauncher) return;

  event.preventDefault();
  nextLauncher.focus();
}

function startRefreshLoop(): void {
  if (intervalId != null) return;
  intervalId = window.setInterval(() => {
    void terminalRail.refreshAll();
  }, 2_000);
}

function stopRefreshLoop(): void {
  if (intervalId == null) return;
  window.clearInterval(intervalId);
  intervalId = null;
}

watch(
  () => props.dashboardVisible,
  (visible) => {
    if (visible) {
      void terminalRail.refreshAll();
      startRefreshLoop();
      return;
    }
    stopRefreshLoop();
  },
  { immediate: true },
);

onUnmounted(() => {
  stopRefreshLoop();
});
</script>

<template>
  <nav v-if="visibleEntries.length > 0" class="rail" aria-label="In progress task terminals" @keydown="handleRailKeydown">
    <ol class="rail-list">
      <li v-for="entry in visibleEntries" :key="entry.taskId">
        <button
          type="button"
          class="rail-button"
          :data-task-id="entry.taskId"
          :data-expanded="expandedTaskId === entry.taskId"
          :style="{ '--rail-tint': railTint(entry.state) }"
          :aria-label="`Task ${entry.index}: ${entry.title}. In progress. ${terminalRailStateLabel(entry.state)} terminal. Press Enter to open; use arrow keys or j/k to move.`"
          @click="openAgentTab(entry.taskId)"
          @pointerenter="setExpanded(entry.taskId)"
          @pointerleave="clearExpanded(entry.taskId)"
          @focus="setExpanded(entry.taskId)"
          @blur="clearExpanded(entry.taskId)"
        >
          <span class="rail-index" aria-hidden="true">{{ entry.index }}</span>
          <span class="rail-dot" aria-hidden="true" />
          <span class="rail-preview" aria-hidden="true">{{ terminalRailTitlePreview(entry.title) }}</span>
          <span class="rail-details">
            <span class="rail-title">{{ entry.title }}</span>
            <span class="rail-state">{{ terminalRailStateLabel(entry.state) }}</span>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.rail {
  position: absolute;
  top: var(--content-top);
  right: calc(var(--gutter) + var(--panel-w) + 16px);
  pointer-events: auto;
}

.rail-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rail-list > li {
  margin: 0;
  padding: 0;
}

.rail-button {
  width: 144px;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  backdrop-filter: blur(var(--blur));
  overflow: hidden;
  color: var(--text);
  transition:
    width 180ms var(--ease-out),
    background-color 140ms var(--ease-out),
    border-color 140ms var(--ease-out);
}

.rail-button:hover,
.rail-button:focus-visible,
.rail-button[data-expanded="true"] {
  width: 220px;
  background: color-mix(in srgb, var(--rail-tint) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--rail-tint) 24%, var(--border-strong));
}

.rail-button:hover .rail-preview,
.rail-button:focus-visible .rail-preview,
.rail-button[data-expanded="true"] .rail-preview {
  display: none;
}

.rail-index {
  width: 10px;
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.rail-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: var(--rail-tint);
  box-shadow: 0 0 8px color-mix(in srgb, var(--rail-tint) 60%, transparent);
}

.rail-preview {
  max-width: 76px;
  flex: none;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-details {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}

.rail-button:hover .rail-details,
.rail-button:focus-visible .rail-details,
.rail-button[data-expanded="true"] .rail-details {
  opacity: 1;
  transform: none;
}

.rail-title,
.rail-state {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-title {
  max-width: 144px;
  font-size: 12.5px;
  font-weight: 500;
}

.rail-state {
  font-size: 11px;
  color: var(--text-2);
}
</style>
