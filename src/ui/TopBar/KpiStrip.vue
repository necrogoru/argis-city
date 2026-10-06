<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Bot, Coins, GitFork, Hand, type LucideIcon } from "@lucide/vue";
import { computeKpis } from "../../domain/kpis";
import { formatTokens } from "../../domain/format";
import { useSnapshotStore } from "../../stores/snapshot";

interface Kpi {
  label: string;
  value: string;
  Icon: LucideIcon;
  alert?: boolean;
}

const { snapshot } = storeToRefs(useSnapshotStore());
const kpis = computed(() => computeKpis(snapshot.value));
const items = computed<Kpi[]>(() => [
  { label: "Active agents", value: String(kpis.value.activeAgents), Icon: Bot },
  { label: "Subagents", value: String(kpis.value.subagents), Icon: GitFork },
  { label: "Tokens total", value: formatTokens(kpis.value.totalTokens), Icon: Coins },
  { label: "Awaiting you", value: String(kpis.value.awaiting), Icon: Hand, alert: true },
]);
</script>

<!-- Active agents · Subagents · Tokens · Awaiting you. -->
<template>
  <dl class="strip" aria-live="off">
    <div v-for="item in items" :key="item.label" class="kpi" :data-alert="item.alert && kpis.awaiting > 0">
      <span class="icon" :data-amber="item.alert">
        <component :is="item.Icon" :size="16" aria-hidden="true" />
      </span>
      <div class="text">
        <dt class="label">{{ item.label }}</dt>
        <dd class="value">{{ item.value }}</dd>
      </div>
    </div>
  </dl>
</template>

<style scoped>
.strip {
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 0 0 0 8px;
  min-width: 0;
}

.kpi {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
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
  margin: 0;
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
  .kpi:nth-child(2),
  .icon {
    display: none;
  }
}
</style>
