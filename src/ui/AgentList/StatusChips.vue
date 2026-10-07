<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus } from "../../domain/types";
import { visibleChips, type StatusCount, type StatusFilter } from "../../domain/agentList";
import { cssVar } from "../../domain/palette";
import { statusMeta } from "../../domain/status";

const props = defineProps<{ counts: readonly StatusCount[]; filter: StatusFilter }>();
const emit = defineEmits<{ toggle: [status: AgentStatus] }>();
const chips = computed(() => visibleChips(props.counts, props.filter));
</script>

<!-- Needs you · Error · Running · Idle · Done — non-zero only; click to filter. -->
<template>
  <div v-if="chips.length > 0" class="chips" role="group" aria-label="Filter by status">
    <button
      v-for="chip in chips"
      :key="chip.status"
      type="button"
      class="chip"
      :style="{ '--tint': cssVar(statusMeta(chip.status).color) }"
      :aria-pressed="filter === chip.status"
      :data-dimmed="filter != null && filter !== chip.status"
      @click="emit('toggle', chip.status)"
    >
      <span class="dot" aria-hidden="true" />{{ statusMeta(chip.status).chipLabel }}<span class="count">{{ chip.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  background: var(--fill-subtle);
  border: 1px solid var(--border);
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
}

.chip:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.chip[aria-pressed="true"] {
  color: var(--tint);
  background: color-mix(in srgb, var(--tint) 14%, transparent);
  border-color: color-mix(in srgb, var(--tint) 40%, transparent);
}

.chip[data-dimmed="true"] {
  opacity: 0.55;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tint);
}

.count {
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.chip[aria-pressed="true"] .count {
  color: inherit;
}
</style>
