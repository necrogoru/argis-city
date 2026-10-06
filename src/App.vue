<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Overlay from "./ui/Overlay.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <CameraControls />
    <EmptyState />
  </Overlay>
</template>
