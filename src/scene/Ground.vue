<script setup lang="ts">
import { Grid } from "@tresjs/cientos";
import { usePressClick } from "../composables/usePressClick";

const emit = defineEmits<{ deselect: [] }>();
const press = usePressClick(() => emit("deselect"));
</script>

<!-- Matte black ground with faint street lines; clicking it deselects. -->
<template>
  <TresGroup>
    <TresMesh :rotation-x="-Math.PI / 2" receive-shadow @pointerdown="press.onPointerdown" @pointerup="press.onPointerup">
      <TresPlaneGeometry :args="[400, 400]" />
      <TresMeshStandardMaterial color="#0C0E0F" :roughness="1" :metalness="0" />
    </TresMesh>
    <!-- World-aligned grid reads as diagonal streets through the iso camera. -->
    <Grid
      :position="[0, 0.004, 0]"
      :args="[160, 160]"
      :cell-size="1.75"
      :cell-thickness="0.6"
      cell-color="#121618"
      :section-size="7"
      :section-thickness="1.1"
      section-color="#1B2124"
      :fade-distance="58"
      :fade-strength="1.6"
      :fade-from="0"
      infinite-grid
    />
  </TresGroup>
</template>
