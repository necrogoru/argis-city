<script setup lang="ts">
import { shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";

const GROW_S = 0.35;
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const group = shallowRef<Group | null>(null);
let start: number | null = null;

useLoop().onBeforeRender(({ elapsed }) => {
  if (!group.value) return;
  start ??= elapsed;
  const p = Math.min(1, (elapsed - start) / GROW_S);
  group.value.scale.setScalar(1 - Math.pow(1 - p, 3));
});
</script>

<!-- Eases its children from scale 0 → 1 on mount, so beacons never pop in. -->
<template>
  <TresGroup ref="group" :scale="0">
    <slot />
  </TresGroup>
</template>
