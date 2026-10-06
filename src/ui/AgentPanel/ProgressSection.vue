<script setup lang="ts">
import { computed } from "vue";
import type { Progress } from "../../domain/types";
import { displayProgress, progressFraction } from "../../domain/progress";
import ProgressRing from "./ProgressRing.vue";

const props = defineProps<{ progress: Progress; currentStep: string | null }>();
const display = computed(() => displayProgress(props.progress));
</script>

<!-- Progress ring beside the "CURRENT STEP" summary. -->
<template>
  <section class="section">
    <ProgressRing :fraction="progressFraction(progress)" :label="display.label" :caption="display.caption" />
    <div class="step">
      <h3 class="caps">Current step</h3>
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
