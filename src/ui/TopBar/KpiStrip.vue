<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Bot, Coins, GitFork, Hand, type LucideIcon } from "@lucide/vue";
import { computeKpis } from "../../domain/kpis";
import { formatTokens } from "../../domain/format";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";

interface Kpi {
  label: string;
  value: string;
  Icon: LucideIcon;
  alert?: boolean;
}

const { snapshot } = storeToRefs(useSnapshotStore());
const selection = useSelectionStore();
const kpis = computed(() => computeKpis(snapshot.value));
const items = computed<Kpi[]>(() => [
  { label: "Active agents", value: String(kpis.value.activeAgents), Icon: Bot },
  { label: "Subagents", value: String(kpis.value.subagents), Icon: GitFork },
  { label: "Tokens total", value: formatTokens(kpis.value.totalTokens), Icon: Coins },
  { label: "Needs you", value: String(kpis.value.awaiting), Icon: Hand, alert: true },
]);
// "Needs you" is a shortcut to the filtered Agents list; inert while nothing waits.
const needsYouAttrs = computed(() => ({
  type: "button",
  disabled: kpis.value.awaiting === 0,
  title: kpis.value.awaiting > 0 ? "Show the agents that need you" : undefined,
  onClick: selection.showNeedsYou,
}));
</script>

<!-- Active agents · Subagents · Tokens · Needs you (click: filter the Agents list). -->
<template>
  <ul class="strip" aria-live="off">
    <li v-for="item in items" :key="item.label" class="item">
      <component
        :is="item.alert ? 'button' : 'div'"
        class="kpi"
        v-bind="item.alert ? needsYouAttrs : {}"
        :data-alert="item.alert && kpis.awaiting > 0"
      >
        <span class="icon" :data-amber="item.alert">
          <component :is="item.Icon" :size="16" aria-hidden="true" />
        </span>
        <span class="text">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.strip {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 0 0 0 8px;
  padding: 0;
  min-width: 0;
}

.item {
  flex: none;
}

.kpi {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

/* The hover fill bleeds past the KPI's box so the strip's rhythm doesn't move. */
button.kpi {
  margin: -6px -10px;
  padding: 6px 10px;
  border-radius: var(--radius-button);
  transition: background-color 140ms ease;
}

button.kpi:hover:not(:disabled) {
  background: color-mix(in srgb, var(--amber) 10%, transparent);
}

.icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: var(--text-2);
  background: var(--fill-subtle);
  border: 1px solid var(--border);
}

.icon[data-amber="true"] {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 10%, transparent);
  border-color: color-mix(in srgb, var(--amber) 22%, transparent);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.value {
  font-size: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.kpi[data-alert="true"] .value {
  color: var(--amber);
}

@media (max-width: 1320px) {
  .strip {
    gap: 18px;
  }
  .item:nth-child(2),
  .icon {
    display: none;
  }
}
</style>
