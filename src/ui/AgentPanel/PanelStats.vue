<script setup lang="ts">
import type { AgentSession } from "../../domain/types";
import { formatClock, formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";
import Elapsed from "../common/Elapsed.vue";
import StatTile from "./StatTile.vue";

function tokensCaption(session: AgentSession): string {
  const share = contextShare(session.tokens);
  const window = session.tokens.contextWindow;
  if (share != null && window != null) return `${Math.round(share * 100)}% of ${formatCompact(window)} ctx`;
  return `${formatTokens(session.tokens.output)} output`;
}

defineProps<{ session: AgentSession }>();
</script>

<!-- Tokens and Elapsed tiles side by side. -->
<template>
  <div class="row">
    <StatTile label="Tokens">
      <template #value>{{ formatTokens(session.tokens.total) }}</template>
      <template #caption>{{ tokensCaption(session) }}</template>
    </StatTile>
    <StatTile label="Elapsed">
      <template #value><Elapsed :item="session" /></template>
      <template #caption>since {{ formatClock(session.startedAt) }}</template>
    </StatTile>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: 10px;
}
</style>
