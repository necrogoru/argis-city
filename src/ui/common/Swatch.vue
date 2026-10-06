<script setup lang="ts">
import { computed } from "vue";
import { cssVar, type PaletteColor } from "../../domain/palette";

const props = withDefaults(defineProps<{ color: PaletteColor; size?: number }>(), { size: 10 });
const style = computed(() => ({
  display: "inline-block",
  flex: "none",
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: "3px",
  background: cssVar(props.color),
  boxShadow: `0 0 8px color-mix(in srgb, ${cssVar(props.color)} 55%, transparent)`,
}));
</script>

<!-- 10px rounded colour swatch identifying a provider. -->
<template>
  <span aria-hidden="true" :style="style" />
</template>
