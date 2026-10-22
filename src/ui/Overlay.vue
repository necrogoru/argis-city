<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { formatHouseCursorAnnouncement } from "../domain/houseNavigation";
import { findSelected } from "../domain/session";
import { useSelectionStore } from "../stores/selection";
import { useSnapshotStore } from "../stores/snapshot";

const selection = useSelectionStore();
const { selectedSession, houseCursorId } = storeToRefs(selection);
const { snapshot } = storeToRefs(useSnapshotStore());
const hasStrip = computed(() => (selectedSession.value?.session.subagents.length ?? 0) > 0);
const houseCursorAnnouncement = computed(() => {
  const candidate = findSelected(snapshot.value, houseCursorId.value);
  return candidate
    ? formatHouseCursorAnnouncement(candidate.meta.label, candidate.houseNumber, candidate.session.title)
    : "";
});
</script>

<!--
  Full-window UI layer above the canvas. Click-through by default; panels opt
  back in. Exposes `--strip-space` so siblings can clear the subagent strip.
-->
<template>
  <div class="overlay" :data-strip="hasStrip">
    <div class="scrim" aria-hidden="true" />
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ houseCursorAnnouncement }}</div>
    <slot />
  </div>
</template>

<style scoped>
.overlay {
  --strip-space: 0px;
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.overlay[data-strip="true"] {
  --strip-space: calc(var(--strip-h) + 16px);
}

/* Left scrim (bg 94% → 0% over ~36%) so the hero reads, plus an edge vignette. */
.scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(10, 11, 12, 0.94) 0%, rgba(10, 11, 12, 0.6) 20%, rgba(10, 11, 12, 0) 36%),
    radial-gradient(ellipse 75% 70% at 55% 50%, rgba(10, 11, 12, 0) 55%, rgba(10, 11, 12, 0.85) 100%);
}
</style>
