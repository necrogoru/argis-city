<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
import SubagentStrip from "./ui/Subagents/SubagentStrip.vue";
import TopBar from "./ui/TopBar/TopBar.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
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
