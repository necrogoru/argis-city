<script setup lang="ts">
import { Html } from "@tresjs/cientos";
import { House as HouseIcon } from "@lucide/vue";
import { useLabelLayer } from "../../composables/useLabelLayer";

/** `progress` is the short readout (`68%`, `ctx 74%`); `—` hides it. */
defineProps<{ position: [number, number, number]; title: string; progress: string }>();
const layer = useLabelLayer();
</script>

<!-- Solid teal callout above the selected house: `title · 68%` (or `· ctx 74%`), line, ring. -->
<template>
  <Html v-if="layer" :position="position" :portal="layer" :z-index-range="[60, 51]">
    <div class="root">
      <div class="callout">
        <span class="tile">
          <HouseIcon :size="14" :stroke-width="2.2" aria-hidden="true" />
        </span>
        <span class="text">
          <span class="title">{{ title }}</span>
          <span v-if="progress !== '—'" class="percent">· {{ progress }}</span>
        </span>
      </div>
      <span class="line" />
      <span class="ring" />
    </div>
  </Html>
</template>

<style scoped>
.root {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Ring centre (11px above the bottom) lands on the anchor point. */
  transform: translate(-50%, calc(-100% + 11px));
  font-family: var(--font);
  user-select: none;
  animation: rise 220ms ease-out;
}

.callout {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px 0 5px;
  border-radius: 12px;
  background: var(--teal);
  color: var(--text-on-accent);
  box-shadow: 0 0 24px rgba(50, 243, 226, 0.35);
  white-space: nowrap;
}

.tile {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(6, 35, 33, 0.14);
}

.text {
  display: flex;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
}

.title {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line {
  width: 1.5px;
  height: 26px;
  background: var(--teal);
}

.ring {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--teal);
  box-shadow: 0 0 10px rgba(50, 243, 226, 0.6), inset 0 0 6px rgba(50, 243, 226, 0.4);
}

@keyframes rise {
  from {
    opacity: 0;
    margin-top: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .root {
    animation: none;
  }
}
</style>
