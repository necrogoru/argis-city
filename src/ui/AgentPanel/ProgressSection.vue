<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus, Progress } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { displayProgress, progressFraction } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import StatusIcon from "../common/StatusIcon.vue";
import ProgressRing from "./ProgressRing.vue";

const HEADINGS: Partial<Record<AgentStatus, string>> = {
  awaitingApproval: "Waiting for you",
  error: "Last turn failed",
};

const props = defineProps<{ progress: Progress; currentStep: string | null; status: AgentStatus }>();
const display = computed(() => displayProgress(props.progress));
const heading = computed(() => HEADINGS[props.status] ?? null);
const meta = computed(() => statusMeta(props.status));
</script>

<!--
  Progress ring beside the step summary. While the session waits on the user or
  has failed, the heading says so in the status colour.
-->
<template>
  <section class="section">
    <ProgressRing
      :fraction="progressFraction(progress)"
      :label="display.label"
      :caption="display.caption"
      :muted="display.percent == null"
    />
    <div class="step">
      <h3 v-if="heading" class="caps heading" :style="{ '--tint': cssVar(meta.color) }">
        <StatusIcon :icon="meta.icon" />{{ heading }}
      </h3>
      <h3 v-else class="caps">Current step</h3>
      <p class="text">{{ currentStep ?? "No recent activity" }}</p>
      <p v-if="display.detail" class="detail">{{ display.detail }}</p>
    </div>
  </section>
</template>

<style scoped>
.section {
  display: flex;
  align-items: center;
  gap: 18px;
}

.step {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.heading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tint);
}

.text {
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail {
  font-size: 12px;
  color: var(--text-3);
}
</style>
