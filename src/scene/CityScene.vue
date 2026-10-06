<script setup lang="ts">
import { useSelectionStore } from "../stores/selection";
import type { CityModel } from "./cityModel";
import Ground from "./Ground.vue";

defineProps<{ city: CityModel }>();
const selection = useSelectionStore();
</script>

<!-- Ground + all four districts, wired to the shared selection state. -->
<template>
  <Ground @deselect="selection.clearSession()" />
</template>
