<script setup lang="ts">
import type { AgentSession } from "../../domain/types";
import { formatClock, formatTokens } from "../../domain/format";
import Elapsed from "../common/Elapsed.vue";
import StatTile from "./StatTile.vue";

defineProps<{ session: AgentSession }>();
</script>

<!-- Tokens and Elapsed tiles side by side; context fill lives in the bar below. -->
<template>
  <div class="row">
    <StatTile label="Tokens">
      <template #value>{{ formatTokens(session.tokens.total) }}</template>
      <template #caption>{{ formatTokens(session.tokens.output) }} output</template>
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
