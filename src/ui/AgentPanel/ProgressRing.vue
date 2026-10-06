<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 0–1 fill. */
    fraction: number;
    label: string;
    caption: string;
    size?: number;
    stroke?: number;
  }>(),
  { size: 112, stroke: 8 },
);
const radius = computed(() => (props.size - props.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const clamped = computed(() => Math.min(1, Math.max(0, props.fraction)));
</script>

<!-- SVG ring: faint track, accent arc with glow, centred value + caption. -->
<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`${label} ${caption}`">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="track" :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="stroke" />
      <circle
        class="arc"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        :stroke-width="stroke"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - clamped)"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="center">
      <span class="value">{{ label }}</span>
      <span class="caption">{{ caption }}</span>
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  flex: none;
}

.track {
  fill: none;
  stroke: var(--track);
}

.arc {
  fill: none;
  stroke: var(--accent);
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 70%, transparent));
  transition: stroke-dashoffset 600ms var(--ease-out);
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.value {
  font-size: 28px;
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.caption {
  font-size: 11px;
  color: var(--text-3);
}
</style>
