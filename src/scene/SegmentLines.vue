<script setup lang="ts">
import { onBeforeUnmount, watch, watchEffect } from "vue";
import { useTres } from "@tresjs/core";
import type { Color } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { Point, Rgb } from "./connectionModel";

const props = withDefaults(
  defineProps<{
    /** Segment pairs: [start, end, start, end, …]. */
    points: Point[];
    /** One colour per point (overrides `color`). */
    vertexColors?: Rgb[];
    color?: Color;
    lineWidth: number;
    dashed?: boolean;
    dashSize?: number;
    gapSize?: number;
  }>(),
  { vertexColors: undefined, color: undefined, dashed: false, dashSize: 1, gapSize: 1 },
);

const { sizes } = useTres();
const material = new LineMaterial({ toneMapped: false });
const line = new LineSegments2(new LineSegmentsGeometry(), material);
defineExpose({ material });

// New geometry only when the points or colours change (not every snapshot).
watch(
  () => [props.points, props.vertexColors] as const,
  ([points, colors]) => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(points.flat());
    if (colors) geometry.setColors(colors.flat());
    line.geometry.dispose();
    line.geometry = geometry;
    line.computeLineDistances();
  },
  { immediate: true },
);

watchEffect(() => {
  material.color.set(props.vertexColors ? 0xffffff : (props.color ?? 0xffffff));
  material.vertexColors = props.vertexColors != null;
  material.linewidth = props.lineWidth;
  material.dashed = props.dashed;
  material.dashSize = props.dashSize;
  material.gapSize = props.gapSize;
  material.resolution.set(sizes.width.value, sizes.height.value);
});

onBeforeUnmount(() => {
  line.geometry.dispose();
  material.dispose();
});
</script>

<!--
  Screen-space segment pairs (three's LineSegments2, as drei's <Line segments>):
  each [start, end] pair is its own segment, so dashes flow start → end.
-->
<template>
  <primitive :object="line" />
</template>
