<script setup lang="ts">
import { shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Mesh } from "three";
import { haloGeometry, HOUSE_TOP } from "../geometries";
import { haloMaterial } from "../materials";

// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const halo = shallowRef<Mesh | null>(null);

useLoop().onBeforeRender(({ delta }) => {
  if (halo.value) halo.value.rotation.y += delta * 0.6;
});
</script>

<!-- "Done": a flat, segmented blue halo slowly turning above the roof. -->
<template>
  <TresMesh ref="halo" :geometry="haloGeometry" :material="haloMaterial" :position-y="HOUSE_TOP + 0.24" />
</template>
