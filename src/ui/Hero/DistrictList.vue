<script setup lang="ts">
import { storeToRefs } from "pinia";
import { PROVIDER_ORDER, PROVIDERS } from "../../domain/providers";
import type { ProviderId, Snapshot } from "../../domain/types";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import Swatch from "../common/Swatch.vue";

function countLabel(snapshot: Snapshot | null, provider: ProviderId): string {
  if (!snapshot) return "—";
  const summary = snapshot.providers.find((p) => p.provider === provider);
  if (summary && !summary.available) return "Not installed";
  const count = snapshot.sessions.filter((s) => s.provider === provider).length;
  return `${count} ${count === 1 ? "house" : "houses"}`;
}

const { snapshot } = storeToRefs(useSnapshotStore());
const selectionStore = useSelectionStore();
const { selection } = storeToRefs(selectionStore);
</script>

<!-- One row per provider; selecting a row focuses the camera on its tower. -->
<template>
  <div class="block">
    <h2 class="caps">Districts</h2>
    <ul class="list">
      <li v-for="id in PROVIDER_ORDER" :key="id">
        <button
          type="button"
          class="row"
          :aria-pressed="selection.provider === id"
          @click="selectionStore.toggleProvider(id)"
        >
          <Swatch :color="PROVIDERS[id].color" />
          <span class="name">{{ PROVIDERS[id].label }}</span>
          <span class="count">{{ countLabel(snapshot, id) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  text-align: left;
  transition: background-color 140ms ease;
}

.row:hover {
  background: var(--fill-subtle);
}

.row[aria-pressed="true"] {
  background: var(--fill-hover);
}

.name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.count {
  font-size: 13px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
</style>
