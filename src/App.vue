<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
import SubagentStrip from "./ui/Subagents/SubagentStrip.vue";
import TaskWorkspace from "./ui/Tasks/TaskWorkspace.vue";
import TopBar from "./ui/TopBar/TopBar.vue";
import { useAppViewStore } from "./stores/appView";

const appView = useAppViewStore();
</script>

<!-- Monitoring remains the default view; task management is an optional workspace. -->
<template>
  <TaskWorkspace v-if="appView.activeView === 'tasks'" />
  <template v-else>
    <CityCanvas />
    <Overlay>
      <TopBar />
      <Hero />
      <CameraControls />
      <EmptyState />
      <RightColumn />
      <SubagentStrip />
    </Overlay>
  </template>
</template>
