<script setup lang="ts">
import { shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Mesh } from "three";
import { beaconGeometry, HOUSE_TOP } from "../geometries";
import { beaconMaterial } from "../materials";

const HOVER_Y = HOUSE_TOP + 0.5;
const props = defineProps<{ phase: number }>();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const diamond = shallowRef<Mesh | null>(null);

useLoop().onBeforeRender(({ elapsed }) => {
  if (!diamond.value) return;
  diamond.value.position.y = HOVER_Y + Math.sin(elapsed * 2.4 + props.phase) * 0.07;
  diamond.value.rotation.y = elapsed * 1.8;
});
</script>

<!-- "Needs you": an amber diamond that bobs and spins above the roof. -->
<template>
  <TresMesh
    ref="diamond"
    :geometry="beaconGeometry"
    :material="beaconMaterial"
    :position-y="HOVER_Y"
    :scale="[1, 1.55, 1]"
  />
</template>
