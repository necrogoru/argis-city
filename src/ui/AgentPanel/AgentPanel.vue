<script setup lang="ts">
import { cssVar } from "../../domain/palette";
import type { SelectedSession } from "../../domain/session";
import ContextBar from "./ContextBar.vue";
import MetaRows from "./MetaRows.vue";
import PanelActions from "./PanelActions.vue";
import PanelHeader from "./PanelHeader.vue";
import PanelStats from "./PanelStats.vue";
import ProgressSection from "./ProgressSection.vue";

defineProps<{ selected: SelectedSession }>();
const emit = defineEmits<{ back: []; close: [] }>();
</script>

<!-- Detail panel for the selected house; lives in the right column in place of the list. -->
<template>
  <aside
    class="glass panel"
    :style="{ '--accent': cssVar(selected.meta.color) }"
    :aria-label="`${selected.session.title} details`"
  >
    <PanelHeader
      :session="selected.session"
      :meta="selected.meta"
      :house-number="selected.houseNumber"
      @back="emit('back')"
      @close="emit('close')"
    />
    <ProgressSection :progress="selected.session.progress" :current-step="selected.session.currentStep" />
    <PanelStats :session="selected.session" />
    <ContextBar :tokens="selected.session.tokens" />
    <MetaRows :session="selected.session" />
    <PanelActions :cwd="selected.session.cwd" />
  </aside>
</template>

<style scoped>
.panel {
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-radius: var(--radius-panel);
  background:
    radial-gradient(260px 200px at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 72%),
    var(--surface);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.panel > * {
  flex: none;
}
</style>
