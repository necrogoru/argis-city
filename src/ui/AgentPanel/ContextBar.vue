<script setup lang="ts">
import { computed } from "vue";
import type { TokenUsage } from "../../domain/types";
import { formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";

type Level = "ok" | "high" | "full";

function levelOf(share: number): Level {
  if (share >= 0.95) return "full";
  return share >= 0.8 ? "high" : "ok";
}

const props = defineProps<{ tokens: TokenUsage }>();
const share = computed(() => contextShare(props.tokens));
const readout = computed(() => {
  const { contextUsed, contextWindow } = props.tokens;
  return share.value != null && contextUsed != null && contextWindow != null
    ? `${formatTokens(contextUsed)} / ${formatCompact(contextWindow)}`
    : "Unknown";
});
</script>

<!-- 6px context-window bar with used / window readout. -->
<template>
  <div class="block">
    <div class="head">
      <span class="caps">Context window</span>
      <span class="readout">{{ readout }}</span>
    </div>
    <div
      class="track"
      role="meter"
      aria-label="Context window usage"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="share == null ? undefined : Math.round(share * 100)"
    >
      <span class="fill" :data-level="share == null ? 'ok' : levelOf(share)" :style="{ width: `${(share ?? 0) * 100}%` }" />
    </div>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.readout {
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.track {
  height: 6px;
  border-radius: 3px;
  background: var(--track);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 60%, transparent);
  transition: width 600ms var(--ease-out);
}

.fill[data-level="high"] {
  background: var(--amber);
}

.fill[data-level="full"] {
  background: var(--red);
}
</style>
