<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Color } from "three";
import type { Point } from "./connectionModel";
import SegmentLines from "./SegmentLines.vue";

const props = defineProps<{ points: Point[]; hex: string }>();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const line = shallowRef<InstanceType<typeof SegmentLines> | null>(null);
const color = computed(() => new Color(props.hex).multiplyScalar(1.8));

useLoop().onBeforeRender(({ delta }) => {
  const material = line.value?.material;
  if (material) material.dashOffset -= delta * 0.9;
});
</script>

<!-- Dashes that stream from running houses towards their tower. -->
<template>
  <SegmentLines ref="line" :points="points" dashed :dash-size="0.22" :gap-size="0.28" :color="color" :line-width="1.6" />
</template>
