<script setup lang="ts">
import { ref } from "vue";
import { useIntervalFn, useTimeoutFn, useWindowFocus } from "@vueuse/core";
import { MARK_CENTER, MARK_DOTS, PUPIL_RADIUS } from "./panoptesMark";

withDefaults(defineProps<{ size?: number }>(), { size: 36 });

/**
 * The eye wakes on a beat instead of looping: SVG animations re-render the
 * page on every frame they run, so between beats the logo costs nothing.
 */
const BEAT_EVERY_MS = 10_000;
const BEAT_MS = 1_600;
/** How fast the ripple travels out from the pupil, in ms per icon unit. */
const RIPPLE_MS_PER_UNIT = 1.6;
const AGENT_STAGGER_MS = 110;

const dots = MARK_DOTS.map((d) => ({ ...d, style: { "--delay": `${Math.round(d.dist * RIPPLE_MS_PER_UNIT)}ms` } }));
const agents = MARK_DOTS.filter((d) => d.agent).map((d, i) => ({
  ...d,
  r: Math.max(d.r, 8),
  style: { "--delay": `${i * AGENT_STAGGER_MS}ms` },
}));

const focused = useWindowFocus();
const beating = ref(false);
const { start: rest } = useTimeoutFn(() => (beating.value = false), BEAT_MS, { immediate: false });

function beat() {
  if (!focused.value) return; // the eye rests while you're in another app
  beating.value = true;
  rest();
}

useIntervalFn(beat, BEAT_EVERY_MS);
useTimeoutFn(beat, 1_200); // one beat shortly after launch
</script>

<!-- The Panoptes mark: one eye made of ~a hundred dots (agents). Each beat a
     ripple runs out from the pupil, a few agents light up, then it blinks. -->
<template>
  <svg class="logo" :class="{ beating }" viewBox="100 100 824 824" :width="size" :height="size" aria-hidden="true">
    <defs>
      <linearGradient id="argis-logo-tile" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#151724" />
        <stop offset="1" stop-color="#07080B" />
      </linearGradient>
      <radialGradient id="argis-logo-glow">
        <stop offset="0" stop-color="#32F3E2" stop-opacity="0.55" />
        <stop offset="0.45" stop-color="#32F3E2" stop-opacity="0.22" />
        <stop offset="1" stop-color="#32F3E2" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="argis-logo-pupil" cx="0.42" cy="0.38" r="0.7">
        <stop offset="0" stop-color="#FFFFFF" />
        <stop offset="0.45" stop-color="#C8FFFA" />
        <stop offset="1" stop-color="#32F3E2" />
      </radialGradient>
    </defs>
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#argis-logo-tile)" />
    <g class="lid">
      <circle class="glow" :cx="MARK_CENTER" :cy="MARK_CENTER" r="160" fill="url(#argis-logo-glow)" />
      <circle
        v-for="d in dots"
        :key="`${d.x},${d.y}`"
        class="dot"
        :cx="d.x"
        :cy="d.y"
        :r="d.r"
        :fill="d.fill"
        :fill-opacity="d.opacity"
        :style="d.style"
      />
      <circle
        v-for="a in agents"
        :key="`agent ${a.x},${a.y}`"
        class="agent"
        :cx="a.x"
        :cy="a.y"
        :r="a.r"
        fill="#32F3E2"
        :style="a.style"
      />
      <circle class="dot" :cx="MARK_CENTER" :cy="MARK_CENTER" :r="PUPIL_RADIUS" fill="url(#argis-logo-pupil)" />
    </g>
  </svg>
</template>

<style scoped>
.logo {
  display: block;
  flex: none;
}

.lid,
.dot,
.glow {
  transform-box: fill-box;
  transform-origin: center;
}

.glow {
  opacity: 0.7;
}

.agent {
  opacity: 0;
}

.beating .dot {
  animation: ripple 900ms ease-in-out var(--delay, 0ms) both;
}

.beating .glow {
  animation: glow 900ms ease-in-out both;
}

.beating .agent {
  animation: wake 1000ms ease-in-out var(--delay) both;
}

.beating .lid {
  animation: blink 380ms ease-in-out 1150ms both;
}

@keyframes ripple {
  50% {
    transform: scale(1.35);
  }
}

@keyframes glow {
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes wake {
  30%,
  70% {
    opacity: 1;
  }
}

@keyframes blink {
  50% {
    transform: scaleY(0.08);
  }
}
</style>
