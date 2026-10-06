<script setup lang="ts">
import type { HouseVisual } from "../../domain/houseVisuals";
import AlertBeacon from "./AlertBeacon.vue";
import DoneHalo from "./DoneHalo.vue";
import GrowIn from "./GrowIn.vue";
import RoofSparks from "./RoofSparks.vue";

defineProps<{ visual: HouseVisual; phase: number }>();
</script>

<!-- The status-specific effect above a house: sparks, alert diamond or done halo. -->
<template>
  <RoofSparks v-if="visual.beacon === 'sparks'" :hex="visual.hex" :phase="phase" />
  <GrowIn v-else-if="visual.beacon === 'alert'" key="alert">
    <AlertBeacon :phase="phase" />
  </GrowIn>
  <GrowIn v-else-if="visual.beacon === 'halo'" key="halo">
    <DoneHalo />
  </GrowIn>
</template>
