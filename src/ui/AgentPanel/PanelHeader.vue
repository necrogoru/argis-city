<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, X } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import type { ProviderMeta } from "../../domain/providers";
import { formatHouseNumber } from "../../domain/format";
import StatusPill from "../common/StatusPill.vue";
import Swatch from "../common/Swatch.vue";

const props = defineProps<{ session: AgentSession; meta: ProviderMeta; houseNumber: number }>();
const emit = defineEmits<{ back: []; close: [] }>();
const details = computed(() =>
  [props.session.model, props.session.pid != null ? `PID ${props.session.pid}` : null].filter(Boolean).join(" · "),
);
</script>

<!-- Crumb, title, back + close buttons, then status pill + `model · PID`. -->
<template>
  <header class="header">
    <div class="top">
      <div class="heading">
        <p class="crumb"><Swatch :color="meta.color" />{{ meta.label }} · House {{ formatHouseNumber(houseNumber) }}</p>
        <h2 class="title" :title="session.title">{{ session.title }}</h2>
      </div>
      <div class="buttons">
        <button type="button" class="iconButton" aria-label="Back to agent list" @click="emit('back')">
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="iconButton" aria-label="Close details" @click="emit('close')">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="status">
      <StatusPill :status="session.status" />
      <span v-if="details" class="details">{{ details }}</span>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-2);
}

.title {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buttons {
  display: flex;
  gap: 6px;
  flex: none;
}

.iconButton {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--text-2);
  border: 1px solid var(--border);
  background: var(--fill-subtle);
}

.iconButton:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.details {
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
