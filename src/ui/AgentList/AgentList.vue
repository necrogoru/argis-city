<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import type { AgentStatus } from "../../domain/types";
import { groupSessions, statusCounts, toggleFilter, type StatusFilter } from "../../domain/agentList";
import { useCameraRigStore } from "../../stores/cameraRig";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import AgentGroup from "./AgentGroup.vue";
import StatusChips from "./StatusChips.vue";

const { snapshot } = storeToRefs(useSnapshotStore());
const selection = useSelectionStore();
const rig = useCameraRigStore();
const filter = ref<StatusFilter>(null);
const sessions = computed(() => snapshot.value?.sessions ?? []);
const counts = computed(() => statusCounts(sessions.value));
const groups = computed(() => groupSessions(sessions.value, filter.value));

function onToggle(status: AgentStatus): void {
  filter.value = toggleFilter(filter.value, status);
}
function onSelect(id: string): void {
  selection.selectSession(id);
  rig.focusSession(id);
}
</script>

<!-- Right-column list of every live session, grouped by provider, filterable by status. -->
<template>
  <section class="glass panel" aria-label="Agents">
    <header class="header">
      <h2 class="title">Agents <span class="total">{{ sessions.length }}</span></h2>
      <StatusChips :counts="counts" :filter="filter" @toggle="onToggle" />
    </header>
    <div class="thin-scroll body">
      <AgentGroup v-for="group in groups" :key="group.provider" :group="group" @select="onSelect" />
      <div v-if="groups.length === 0" class="empty">
        <p>{{ !snapshot ? "Scanning for agents…" : filter ? "No agents with this status." : "No live agents right now." }}</p>
        <button v-if="filter" type="button" class="clear" @click="filter = null">Clear filter</button>
        <p v-else-if="snapshot" class="hint">Start a Claude Code, Codex, OpenCode or Pi session.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  border-radius: var(--radius-panel);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.header {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 500;
}

.total {
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--fill-hover);
}

.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 10px 12px;
}

.empty {
  padding: 28px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: var(--text-2);
  font-size: 13px;
}

.hint {
  font-size: 12px;
  color: var(--text-3);
}

.clear {
  height: 30px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid var(--border-strong);
  background: var(--fill-hover);
  font-size: 12.5px;
  font-weight: 500;
}
</style>
