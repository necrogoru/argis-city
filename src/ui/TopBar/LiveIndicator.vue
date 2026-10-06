<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useIntervalFn, useTimestamp } from "@vueuse/core";
import { POLL_INTERVAL_MS } from "../../services/agentSource";
import { useAgentSource } from "../../composables/useAgentSource";
import { useSnapshotStore } from "../../stores/snapshot";

/** A snapshot older than this many poll intervals counts as stale. */
const STALE_AFTER = 3;

type Tone = "live" | "stale" | "error";

const source = useAgentSource();
const { snapshot, error } = storeToRefs(useSnapshotStore());
// Ticks once per poll interval (useTimestamp's default scheduler is every animation frame).
const now = useTimestamp({ scheduler: (tick) => useIntervalFn(tick, POLL_INTERVAL_MS) });
const seconds = POLL_INTERVAL_MS / 1000;

const tone = computed<Tone>(() => {
  const stale = snapshot.value != null && now.value - snapshot.value.generatedAt > POLL_INTERVAL_MS * STALE_AFTER;
  return error.value && !snapshot.value ? "error" : stale ? "stale" : "live";
});
const text = computed(() =>
  tone.value === "error"
    ? "Backend unavailable"
    : tone.value === "stale"
      ? "Reconnecting…"
      : `${source.kind === "demo" ? "Demo data" : "Live"} · scanning ${seconds}s`,
);
</script>

<!-- "Live · scanning 2s" pill; turns amber when updates stop arriving. -->
<template>
  <div class="pill" :data-tone="tone" role="status">
    <span class="dot" aria-hidden="true" />{{ text }}
  </div>
</template>

<style scoped>
.pill {
  --tone: var(--teal);
  display: flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 16px 0 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 9%, #0e1112e6);
  border: 1px solid color-mix(in srgb, var(--tone) 24%, transparent);
  backdrop-filter: blur(var(--blur));
  -webkit-backdrop-filter: blur(var(--blur));
}

.pill[data-tone="stale"] {
  --tone: var(--amber);
}

.pill[data-tone="error"] {
  --tone: var(--red);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 8px 1px var(--tone);
  animation: breathe 2s ease-in-out infinite;
}

/* Opacity only: it runs on the compositor. Animating box-shadow here repaints
   the dot — and re-renders the pill's backdrop blur — on every vsync. */
@keyframes breathe {
  50% {
    opacity: 0.45;
  }
}
</style>
