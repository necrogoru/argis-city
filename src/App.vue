<script setup lang="ts">
import { computed, ref } from "vue";
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import CommandPalette from "./ui/CommandPalette/CommandPalette.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
import SubagentStrip from "./ui/Subagents/SubagentStrip.vue";
import TaskWorkspace from "./ui/Tasks/TaskWorkspace.vue";
import TerminalModal from "./ui/Tasks/TerminalModal.vue";
import TopBar from "./ui/TopBar/TopBar.vue";
import { useAppViewStore } from "./stores/appView";
import { useTaskStore } from "./stores/tasks";
import { useTerminalNavigationStore } from "./stores/terminalNavigation";
import { useAppViewShortcuts } from "./composables/useAppViewShortcuts";
import { isViewShortcutBlocked } from "./domain/appViewShortcuts";
import { useModKey } from "./composables/useModKey";

const appView = useAppViewStore();
const taskStore = useTaskStore();
const terminalNavigation = useTerminalNavigationStore();
const paletteOpen = ref(false);
const terminalTask = computed(
  () => taskStore.tasks.find((task) => task.id === terminalNavigation.taskId) ?? null,
);

useAppViewShortcuts();
useModKey(
  "k",
  () => (paletteOpen.value = !paletteOpen.value),
  (event) => {
    if (paletteOpen.value) return true;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const hasOpenDialog = document.querySelector("dialog[open]") !== null;
    return !isViewShortcutBlocked(target, hasOpenDialog);
  },
);
</script>

<!-- Monitoring remains the default view; task management is an optional workspace. -->
<template>
  <TaskWorkspace v-if="appView.activeView === 'tasks'" />
  <template v-else>
    <CityCanvas />
    <Overlay>
      <TopBar :palette-open="paletteOpen" @open-palette="paletteOpen = true" />
      <Hero />
      <CameraControls />
      <EmptyState />
      <RightColumn />
      <SubagentStrip />
    </Overlay>
  </template>
  <CommandPalette v-model:open="paletteOpen" />
  <TerminalModal
    v-if="terminalTask"
    :key="terminalTask.id"
    :task="terminalTask"
    v-model:open="terminalNavigation.open"
    @close="terminalNavigation.closeTerminal()"
  />
</template>
