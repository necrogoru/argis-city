<script setup lang="ts">
import { computed } from "vue";
import { GitFork, Hand } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { displayProgress } from "../../domain/progress";
import { needsUser, subagentCounts } from "../../domain/session";
import { statusMeta } from "../../domain/status";
import { useHoverStore } from "../../stores/hover";
import Elapsed from "../common/Elapsed.vue";

const props = defineProps<{ session: AgentSession }>();
const emit = defineEmits<{ select: [id: string] }>();
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.session.id);
const meta = computed(() => statusMeta(props.session.status));
const progress = computed(() => displayProgress(props.session.progress));
const subagents = computed(() => subagentCounts(props.session));
const subagentsTitle = computed(() => {
  const { total, awaiting } = subagents.value;
  const plural = total === 1 ? "subagent" : "subagents";
  if (awaiting === 0) return `${total} ${plural}`;
  return `${awaiting} of ${total} ${plural} need${awaiting === 1 ? "s" : ""} approval`;
});
const enter = () => hover.set(props.session.id);
const leave = () => hover.clear(props.session.id);
</script>

<!--
  Status accent + dot, title, `model · elapsed`, progress (`63%`, or `ctx 66%`
  when only context fill is known) and a subagent badge that turns amber when a
  subagent waits on the user — the row then sorts and tints as "Needs you".
-->
<template>
  <li>
    <button
      type="button"
      class="row"
      :style="{ '--tint': cssVar(meta.color) }"
      :data-status="session.status"
      :data-needs-you="needsUser(session)"
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
        <span
          class="percent"
          :data-source="session.progress.source"
          :title="session.progress.source === 'context' ? 'Context window fill (no plan to measure progress)' : undefined"
        >{{ progress.short }}</span>
        <span v-if="subagents.total > 0" class="badge" :data-alert="subagents.awaiting > 0" :title="subagentsTitle">
          <template v-if="subagents.awaiting > 0"><Hand :size="10" aria-hidden="true" />{{ subagents.awaiting }}</template>
          <template v-else><GitFork :size="10" aria-hidden="true" />{{ subagents.total }}</template>
        </span>
      </span>
      <span class="sr-only">{{ meta.label }}<template v-if="subagents.awaiting > 0">, {{ subagentsTitle }}</template></span>
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

.row[data-needs-you="true"] {
  background: color-mix(in srgb, var(--amber) 9%, transparent);
}

.row[data-needs-you="true"]:hover,
.row[data-needs-you="true"][data-hovered="true"] {
  background: color-mix(in srgb, var(--amber) 15%, transparent);
}

/* text-3 drops below 4.5:1 on the amber tint. */
.row[data-needs-you="true"] .sub {
  color: var(--text-2);
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
  white-space: nowrap;
}

/* Context fill, not progress: quieter so it doesn't read as "nearly done". */
.percent[data-source="context"] {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.row[data-needs-you="true"] .percent[data-source="context"] {
  color: var(--text-2);
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

.badge[data-alert="true"] {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 16%, transparent);
}

@keyframes urgent {
  50% {
    opacity: 0.3;
  }
}
</style>
