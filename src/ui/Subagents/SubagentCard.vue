<script setup lang="ts">
import { computed } from "vue";
import { Clock, Coins, Gauge } from "@lucide/vue";
import type { SubAgent } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { formatTokens } from "../../domain/format";
import { displayProgress, progressFraction } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import Elapsed from "../common/Elapsed.vue";
import StatusPill from "../common/StatusPill.vue";

const props = defineProps<{ agent: SubAgent }>();
const progress = computed(() => displayProgress(props.agent.progress));
const tooltip = computed(() => (props.agent.kind ? `${props.agent.title} (${props.agent.kind})` : props.agent.title));
</script>

<!-- Title + status pill, 4px progress bar in status colour, % · tokens · elapsed. -->
<template>
  <article class="card" :style="{ '--tint': cssVar(statusMeta(agent.status).color) }" :data-status="agent.status">
    <div class="top">
      <h3 class="title" :title="tooltip">{{ agent.title }}</h3>
      <StatusPill :status="agent.status" />
    </div>
    <div class="bar" aria-hidden="true">
      <span :style="{ width: `${progressFraction(agent.progress) * 100}%` }" />
    </div>
    <div class="meta">
      <span :title="agent.progress.source === 'context' ? 'Context window fill (no plan)' : `Progress: ${progress.caption}`">
        <Gauge :size="12" aria-hidden="true" />{{ progress.short }}
      </span>
      <span title="Tokens"><Coins :size="12" aria-hidden="true" />{{ formatTokens(agent.tokens.total) }}</span>
      <span title="Elapsed"><Clock :size="12" aria-hidden="true" /><Elapsed :item="agent" /></span>
    </div>
  </article>
</template>

<style scoped>
.card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--fill-subtle);
  border: 1px solid var(--border);
}

.card[data-status="awaitingApproval"] {
  background: color-mix(in srgb, var(--amber) 8%, transparent);
  border-color: color-mix(in srgb, var(--amber) 32%, transparent);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.title {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar {
  height: 4px;
  border-radius: 2px;
  background: var(--track);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tint);
  box-shadow: 0 0 6px var(--tint);
  transition: width 600ms var(--ease-out);
}

.meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.meta :deep(svg) {
  color: var(--text-3);
}
</style>
