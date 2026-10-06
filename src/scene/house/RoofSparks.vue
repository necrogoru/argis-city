<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { AdditiveBlending, Color, type BufferAttribute, type Points } from "three";
import { HOUSE_TOP } from "../geometries";
import { EMBERS, getSparkTexture, SPARK_COUNT, SPARK_RISE } from "./sparks";

const props = defineProps<{ hex: string; phase: number }>();
// Template refs to three.js objects are plain shallowRefs: in dev builds useTemplateRef
// returns a readonly view that silently drops every mutation to a three.js object.
const points = shallowRef<Points | null>(null);
const base = computed(() => new Color(props.hex).multiplyScalar(2.2));
const positions = new Float32Array(SPARK_COUNT * 3);
const colors = new Float32Array(SPARK_COUNT * 3);
const texture = getSparkTexture();

useLoop().onBeforeRender(({ elapsed }) => {
  const geometry = points.value?.geometry;
  if (!geometry) return;
  const position = geometry.getAttribute("position") as BufferAttribute;
  const color = geometry.getAttribute("color") as BufferAttribute;
  const tint = base.value;
  EMBERS.forEach((ember, i) => {
    const life = (elapsed * ember.speed + ember.offset + props.phase) % 1;
    const angle = ember.angle + elapsed * 0.5;
    const spread = 0.04 + life * ember.drift;
    position.setXYZ(i, Math.cos(angle) * spread, HOUSE_TOP - 0.05 + life * SPARK_RISE, Math.sin(angle) * spread);
    const fade = Math.sin(life * Math.PI); // fade in, then out
    color.setXYZ(i, tint.r * fade, tint.g * fade, tint.b * fade);
  });
  position.needsUpdate = true;
  color.needsUpdate = true;
});
</script>

<!-- "Running": a few light sparks drifting up from the roof apex, fading as they rise. -->
<template>
  <TresPoints ref="points" :frustum-culled="false">
    <TresBufferGeometry>
      <TresBufferAttribute attach="attributes-position" :args="[positions, 3]" />
      <TresBufferAttribute attach="attributes-color" :args="[colors, 3]" />
    </TresBufferGeometry>
    <TresPointsMaterial
      :map="texture"
      :size="6"
      :size-attenuation="false"
      vertex-colors
      transparent
      :depth-write="false"
      :blending="AdditiveBlending"
      :tone-mapped="false"
    />
  </TresPoints>
</template>
