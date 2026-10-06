<script setup lang="ts">
import { computed } from "vue";
import type { AgentGroup as AgentGroupModel } from "../../domain/agentList";
import Swatch from "../common/Swatch.vue";
import AgentRow from "./AgentRow.vue";

const props = defineProps<{ group: AgentGroupModel }>();
const emit = defineEmits<{ select: [id: string] }>();
const headingId = computed(() => `agents-${props.group.provider}`);
</script>

<!-- Caps header (swatch · provider · count) followed by its session rows. -->
<template>
  <section class="group" :aria-labelledby="headingId">
    <h3 :id="headingId" class="caps heading">
      <Swatch :color="group.meta.color" :size="8" />
      <span class="name">{{ group.meta.label }}</span>
      <span class="count">{{ group.sessions.length }}</span>
    </h3>
    <ul class="rows">
      <AgentRow v-for="session in group.sessions" :key="session.id" :session="session" @select="emit('select', $event)" />
    </ul>
  </section>
</template>

<style scoped>
.group {
  padding-top: 10px;
}

.heading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 6px;
}

.name {
  flex: 1;
}

.count {
  font-variant-numeric: tabular-nums;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
