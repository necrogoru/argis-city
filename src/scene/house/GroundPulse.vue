<script setup lang="ts">
import { computed } from "vue";
import { useLoop } from "@tresjs/core";
import { Color, type Mesh, type MeshBasicMaterial } from "three";
import { ringPulse } from "../../domain/houseVisuals";
import { pulseRingGeometry } from "../geometries";

const LOOP_PERIOD_S = 1.8;
const ONCE_PERIOD_S = 1;

const props = withDefaults(
  defineProps<{
    hex: string;
    /** Loop forever (needs you) or play once (~1 s ripple when a session finishes). */
    loop?: boolean;
  }>(),
  { loop: false },
);
const color = computed(() => new Color(props.hex).multiplyScalar(1.8));
const count = props.loop ? 2 : 1;
const rings: (Mesh | null)[] = [];
let start: number | null = null;

useLoop().onBeforeRender(({ elapsed }) => {
  start ??= elapsed;
  const t = elapsed - start;
  rings.forEach((mesh, i) => {
    if (!mesh) return;
    const raw = props.loop ? t / LOOP_PERIOD_S + i / count : t / ONCE_PERIOD_S;
    const { scale, opacity } = ringPulse(props.loop ? raw % 1 : raw);
    mesh.visible = props.loop || raw < 1;
    mesh.scale.setScalar(scale);
    (mesh.material as MeshBasicMaterial).opacity = opacity * 0.85;
  });
});

function setRing(index: number, mesh: unknown): void {
  rings[index] = (mesh as Mesh | null) ?? null;
}
</script>

<!-- Expanding, fading ground ring(s) around a house lot. -->
<template>
  <TresMesh
    v-for="i in count"
    :key="i"
    :ref="(mesh) => setRing(i - 1, mesh)"
    :geometry="pulseRingGeometry"
    :position-y="0.05"
    :render-order="2"
  >
    <TresMeshBasicMaterial :color="color" transparent :opacity="0" :tone-mapped="false" :depth-write="false" />
  </TresMesh>
</template>
