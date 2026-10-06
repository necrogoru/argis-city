<script setup lang="ts">
import { computed } from "vue";
import { GitFork } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import { formatPercent } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { clampPercent } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import { useHoverStore } from "../../stores/hover";
import Elapsed from "../common/Elapsed.vue";

const props = defineProps<{ session: AgentSession }>();
const emit = defineEmits<{ select: [id: string] }>();
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.session.id);
const meta = computed(() => statusMeta(props.session.status));
const enter = () => hover.set(props.session.id);
const leave = () => hover.clear(props.session.id);
</script>

<!-- Status accent + dot, title, `model · elapsed`, progress % and subagent badge. -->
<template>
  <li>
    <button
      type="button"
      class="row"
      :style="{ '--tint': cssVar(meta.color) }"
      :data-status="session.status"
      :data-hovered="hovered"
      @click="emit('select', session.id)"
      @pointerenter="enter"
      @pointerleave="leave"
      @focus="enter"
      @blur="leave"
    >
      <span class="accent" aria-hidden="true" />
      <span class="dot" aria-hidden="true" />
      <span class="main">
        <span class="title">{{ session.title }}</span>
        <span class="sub">{{ session.model ?? "unknown model" }} · <Elapsed :item="session" /></span>
      </span>
      <span class="side">
        <span class="percent">{{ formatPercent(clampPercent(session.progress.percent)) }}</span>
        <span v-if="session.subagents.length > 0" class="badge" :title="`${session.subagents.length} subagents`">
          <GitFork :size="10" aria-hidden="true" />{{ session.subagents.length }}
        </span>
      </span>
      <span class="sr-only">{{ meta.label }}</span>
    </button>
  </li>
</template>

<style scoped>
.row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 9px 14px;
  border-radius: 12px;
  text-align: left;
  overflow: hidden;
  transition: background-color 140ms ease;
}

.row:hover,
.row[data-hovered="true"] {
  background: var(--fill-hover);
}

.row[data-status="awaitingApproval"] {
  background: color-mix(in srgb, var(--amber) 9%, transparent);
}

.row[data-status="awaitingApproval"]:hover,
.row[data-status="awaitingApproval"][data-hovered="true"] {
  background: color-mix(in srgb, var(--amber) 15%, transparent);
}

.accent {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--tint);
  box-shadow: 0 0 8px color-mix(in srgb, var(--tint) 60%, transparent);
}

.dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--tint);
}

.row[data-status="awaitingApproval"] .dot {
  animation: urgent 1.2s ease-in-out infinite;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title,
.sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-size: 14px;
  font-weight: 500;
}

.sub {
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.percent {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 17px;
  padding: 0 5px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--fill-hover);
}

@keyframes urgent {
  50% {
    opacity: 0.3;
  }
}
</style>
