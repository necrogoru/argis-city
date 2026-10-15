<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef } from "vue";
import { storeToRefs } from "pinia";
import { Search } from "@lucide/vue";
import { tokenize, wrapIndex } from "../../domain/search";
import { invokeCommandAction, useCommandActions } from "../../composables/useCommandActions";
import { useCameraRigStore } from "../../stores/cameraRig";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import { useAppViewStore } from "../../stores/appView";
import { useTaskStore } from "../../stores/tasks";
import { useTerminalNavigationStore } from "../../stores/terminalNavigation";
import { taskPaletteAction } from "./taskPaletteAction";
import Kbd from "../common/Kbd.vue";
import PaletteOption from "./PaletteOption.vue";
import PaletteSection from "./PaletteSection.vue";
import { buildPaletteResults } from "./paletteResults";
import type { PaletteOptionModel } from "./paletteOptionModel";

const emit = defineEmits<{ close: [] }>();
const { snapshot } = storeToRefs(useSnapshotStore());
const selection = useSelectionStore();
const rig = useCameraRigStore();
const appView = useAppViewStore();
const taskStore = useTaskStore();
const terminalNavigation = useTerminalNavigationStore();
const actions = useCommandActions();
const query = ref("");
const taskSearchError = ref<string | null>(null);
// Track the cursor by key so live snapshot reordering doesn't move it.
const activeKey = ref<string | null>(null);
const listId = useId();
const list = useTemplateRef<HTMLDivElement>("list");

const sessions = computed(() => snapshot.value?.sessions ?? []);
const hasQuery = computed(() => tokenize(query.value).length > 0);
const options = computed<PaletteOptionModel[]>(() =>
  buildPaletteResults(sessions.value, taskStore.tasks, taskStore.projects, actions.value, query.value),
);
const activeIndex = computed(() => {
  const found = options.value.findIndex((o) => o.key === activeKey.value);
  return found >= 0 ? found : options.value.length > 0 ? 0 : -1;
});
const optionId = (index: number) => `${listId}-option-${index}`;

onMounted(() => {
  void taskStore.ensureSearchDataLoaded().catch((reason: unknown) => {
    taskSearchError.value = reason instanceof Error ? reason.message : String(reason);
  });
});

function run(option: PaletteOptionModel): void {
  if (option.kind === "action") {
    invokeCommandAction(option.action, () => emit("close"));
    return;
  }

  emit("close");
  if (option.kind === "agent") {
    selection.selectSession(option.session.id);
    rig.focusSession(option.session.id);
    return;
  }

  void nextTick(() => {
    if (taskPaletteAction(option.task) === "open-terminal") terminalNavigation.openTaskTerminal(option.task.id);
    else appView.showTasks();
  });
}

function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  activeKey.value = null;
  list.value?.scrollTo({ top: 0 });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = wrapIndex(activeIndex.value, event.key === "ArrowDown" ? 1 : -1, options.value.length);
    activeKey.value = options.value[next]?.key ?? null;
    // Only keyboard moves scroll; hover and live updates leave the scroll position alone.
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" && activeIndex.value >= 0) {
    event.preventDefault();
    run(options.value[activeIndex.value]);
  }
}
</script>

<!-- Mounted only while open, so every opening starts with an empty query. -->
<template>
  <div class="search">
    <Search :size="18" class="searchIcon" aria-hidden="true" />
    <input
      class="input"
      type="text"
      role="combobox"
      aria-expanded="true"
      :aria-controls="listId"
      aria-autocomplete="list"
      :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
      aria-label="Search agents, tasks, terminals, and actions"
      placeholder="Search agents, tasks, terminals, or actions…"
      autocomplete="off"
      spellcheck="false"
      :value="query"
      @input="onInput"
      @keydown="onKeydown"
    />
    <Kbd>esc</Kbd>
  </div>

  <div :id="listId" ref="list" role="listbox" aria-label="Results" class="thin-scroll results">
    <PaletteSection v-if="options.length > 0" :title="hasQuery ? 'Results' : 'Actions'">
      <PaletteOption
        v-for="(option, i) in options"
        :key="option.key"
        :option="option"
        :dom-id="optionId(i)"
        :active="i === activeIndex"
        :query="query"
        @hover="activeKey = option.key"
        @run="run(option)"
      />
    </PaletteSection>
    <p v-if="options.length === 0 && taskStore.searchLoading" class="empty" role="status">Loading task search…</p>
    <p v-else-if="options.length === 0 && taskSearchError" class="empty" role="alert">
      Task search unavailable: {{ taskSearchError }}
    </p>
    <p v-else-if="options.length === 0" class="empty">No agents, tasks, or actions match “{{ query.trim() }}”.</p>
  </div>

  <footer class="footer" aria-hidden="true">
    <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
    <span><Kbd>↵</Kbd> open</span>
    <span><Kbd>esc</Kbd> close</span>
  </footer>
</template>

<style scoped>
.search {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 0 18px 0 20px;
  border-bottom: 1px solid var(--border);
}

.searchIcon {
  flex: none;
  color: var(--text-3);
}

.input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 16px;
  color: var(--text);
}

.input::placeholder {
  color: var(--text-3);
}

.input:focus-visible {
  outline: none;
}

.results {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px 8px;
}
.empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
}

.footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 44px;
  padding: 0 20px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-3);
}

.footer span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.footer span > kbd:last-of-type {
  margin-right: 2px;
}
</style>
