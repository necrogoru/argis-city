<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { GitFork } from "@lucide/vue";
import { subagentCounts } from "../../domain/session";
import { useSelectionStore } from "../../stores/selection";
import SubagentCard from "./SubagentCard.vue";

const { selectedSession } = storeToRefs(useSelectionStore());
const session = computed(() => {
  const selected = selectedSession.value?.session;
  return selected && selected.subagents.length > 0 ? selected : null;
});
const counts = computed(() => (session.value ? subagentCounts(session.value) : null));
</script>

<!-- Bottom strip listing the selected session's subagents (only when it has any). -->
<template>
  <section v-if="session && counts" class="glass strip" aria-label="Subagents">
    <header class="head">
      <h2 class="title"><GitFork :size="16" aria-hidden="true" />Subagents</h2>
      <p class="parent" :title="session.title">Spawned by <span>{{ session.title }}</span></p>
      <p class="counts">{{ counts.total }} total · {{ counts.running }} running</p>
    </header>
    <ul class="cards">
      <li v-for="agent in session.subagents" :key="agent.id" class="item">
        <SubagentCard :agent="agent" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.strip {
  position: absolute;
  left: var(--gutter);
  right: var(--gutter);
  bottom: var(--gutter);
  height: var(--strip-h);
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-panel);
  pointer-events: auto;
  animation: enter 280ms var(--ease-out);
}

.head {
  flex: none;
  width: 200px;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
}

.title :deep(svg) {
  color: var(--teal);
}

.parent,
.counts {
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parent span {
  color: var(--text-2);
}

.cards {
  flex: 1;
  min-width: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 10px;
  overflow-x: auto;
}

.item {
  flex: 1 1 0;
  min-width: 210px;
  display: flex;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}
</style>
