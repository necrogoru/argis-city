<script setup lang="ts">
import { RefreshCw } from "@lucide/vue";
import { useSnapshotStore } from "../../stores/snapshot";
import IconButton from "../common/IconButton.vue";
import Brand from "./Brand.vue";
import KpiStrip from "./KpiStrip.vue";
import LiveIndicator from "./LiveIndicator.vue";
import SearchTrigger from "./SearchTrigger.vue";

const snapshots = useSnapshotStore();
</script>

<!-- Brand · KPIs · search (⌘K) · live status + refresh. -->
<template>
  <header class="bar">
    <Brand />
    <KpiStrip />
    <div class="right">
      <SearchTrigger />
      <LiveIndicator />
      <IconButton label="Refresh now" :size="48" @click="snapshots.refresh()">
        <RefreshCw :size="18" aria-hidden="true" />
      </IconButton>
    </div>
  </header>
</template>

<style scoped>
.bar {
  position: absolute;
  top: var(--top-bar-y);
  left: var(--gutter);
  right: var(--gutter);
  height: var(--top-bar-h);
  display: flex;
  align-items: center;
  gap: 28px;
  pointer-events: none;
}

.bar > * {
  pointer-events: auto;
}

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
