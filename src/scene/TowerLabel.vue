<script setup lang="ts">
import { Html } from "@tresjs/cientos";
import type { ProviderMeta } from "../domain/providers";
import { useLabelLayer } from "../composables/useLabelLayer";
import type { DistrictState } from "./cityModel";

const NOTES: Readonly<Record<DistrictState, string | null>> = {
  live: null,
  empty: "No live sessions",
  unavailable: "Not installed",
};

defineProps<{
  position: [number, number, number];
  meta: ProviderMeta;
  count: number;
  state: DistrictState;
  highlighted: boolean;
}>();
const emit = defineEmits<{ focus: [meta: ProviderMeta] }>();
const layer = useLabelLayer();
</script>

<!-- In-scene glass pill anchored to the tower top, rendered into the label layer. -->
<template>
  <Html v-if="layer" :position="position" :portal="layer" :z-index-range="[50, 41]">
    <div class="root" :style="{ '--accent': meta.hex }" :data-state="state">
      <button
        type="button"
        class="pill"
        :data-highlighted="highlighted"
        :aria-label="`Focus ${meta.label} district, ${count} live sessions`"
        @click="emit('focus', meta)"
      >
        <span class="swatch" />
        <span class="name">{{ meta.label }}</span>
        <span class="count">{{ count }}</span>
      </button>
      <span v-if="NOTES[state]" class="note">{{ NOTES[state] }}</span>
      <span class="line" />
      <span class="dot" />
    </div>
  </Html>
</template>

<style scoped>
.root {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -100%);
  font-family: var(--font);
  user-select: none;
}

.pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 6px 0 12px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  white-space: nowrap;
  transition: border-color 160ms ease, transform 160ms ease;
}

.pill:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}

.pill[data-highlighted="true"] {
  border-color: var(--accent);
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.count {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  background: var(--fill-hover);
}

.note {
  margin-top: 6px;
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--text-3);
  white-space: nowrap;
}

.line {
  width: 1px;
  height: 34px;
  background: linear-gradient(to bottom, transparent, var(--accent));
  opacity: 0.8;
}

.dot {
  width: 7px;
  height: 7px;
  margin-bottom: -3.5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px 1px var(--accent), 0 0 14px 2px var(--accent);
}

.root[data-state="empty"] .swatch,
.root[data-state="unavailable"] .swatch,
.root[data-state="empty"] .dot,
.root[data-state="unavailable"] .dot {
  box-shadow: none;
  opacity: 0.45;
}

.root[data-state="unavailable"] .line,
.root[data-state="empty"] .line {
  opacity: 0.3;
}
</style>
