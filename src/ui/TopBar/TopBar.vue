<script setup lang="ts">
import { List, RefreshCw } from "@lucide/vue";
import { useSnapshotStore } from "../../stores/snapshot";
import { useAppViewStore } from "../../stores/appView";
import { formatModKeyLabel, MOD_KEY_ARIA } from "../../composables/useModKey";
import IconButton from "../common/IconButton.vue";
import Kbd from "../common/Kbd.vue";
import Brand from "./Brand.vue";
import KpiStrip from "./KpiStrip.vue";
import LiveIndicator from "./LiveIndicator.vue";
import SearchTrigger from "./SearchTrigger.vue";

const props = defineProps<{ paletteOpen: boolean }>();
const emit = defineEmits<{ openPalette: [] }>();
const snapshots = useSnapshotStore();
const appView = useAppViewStore();
</script>

<!-- Brand · KPIs · search (⌘K) · live status + refresh. -->
<template>
  <header class="bar">
    <Brand />
    <KpiStrip />
    <div class="right">
      <SearchTrigger :open="props.paletteOpen" @open="emit('openPalette')" />
      <IconButton
        :label="`Open tasks (${formatModKeyLabel('2')})`"
        :aria-keyshortcuts="`${MOD_KEY_ARIA}+2`"
        :size="48"
        @click="appView.showTasks()"
      >
        <span class="tasks-shortcut">
          <List :size="18" aria-hidden="true" />
          <Kbd aria-hidden="true">{{ formatModKeyLabel("2") }}</Kbd>
        </span>
      </IconButton>
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

.tasks-shortcut {
  position: relative;
  display: grid;
  place-items: center;
}

.tasks-shortcut :deep(.kbd) {
  position: absolute;
  right: -12px;
  bottom: -9px;
  min-width: 20px;
  height: 18px;
  padding: 0 4px;
  font-size: 10px;
  background: var(--bg);
}
</style>
