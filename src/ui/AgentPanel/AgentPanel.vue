<script setup lang="ts">
import { computed } from "vue";
import { cssVar } from "../../domain/palette";
import type { SelectedSession } from "../../domain/session";
import { statusMeta } from "../../domain/status";
import ContextBar from "./ContextBar.vue";
import MetaRows from "./MetaRows.vue";
import PanelActions from "./PanelActions.vue";
import PanelHeader from "./PanelHeader.vue";
import PanelStats from "./PanelStats.vue";
import ProgressSection from "./ProgressSection.vue";

const props = defineProps<{ selected: SelectedSession }>();
const emit = defineEmits<{ back: []; close: [] }>();
// Provider colour drives the ring and bars; the panel's glow and stroke switch
// to the status colour while the session waits on the user or has failed.
const style = computed(() => {
  const { session, meta } = props.selected;
  const alert = session.status === "awaitingApproval" || session.status === "error";
  return {
    "--accent": cssVar(meta.color),
    "--glow": cssVar(alert ? statusMeta(session.status).color : meta.color),
  };
});
</script>

<!-- Detail panel for the selected house; lives in the right column in place of the list. -->
<template>
  <aside
    class="glass panel"
    :style="style"
    :data-status="selected.session.status"
    :aria-label="`${selected.session.title} details`"
  >
    <PanelHeader
      :session="selected.session"
      :meta="selected.meta"
      :house-number="selected.houseNumber"
      @back="emit('back')"
      @close="emit('close')"
    />
    <ProgressSection
      :progress="selected.session.progress"
      :current-step="selected.session.currentStep"
      :status="selected.session.status"
    />
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
    radial-gradient(260px 200px at 100% 0%, color-mix(in srgb, var(--glow) 16%, transparent), transparent 72%),
    var(--surface);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  transition: border-color 200ms var(--ease-out);
}

.panel[data-status="awaitingApproval"],
.panel[data-status="error"] {
  border-color: color-mix(in srgb, var(--glow) 40%, transparent);
}

.panel > * {
  flex: none;
}
</style>
