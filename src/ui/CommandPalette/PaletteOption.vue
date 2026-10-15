<script setup lang="ts">
import { computed } from "vue";
import { SquareTerminal } from "@lucide/vue";
import { tildify } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { PROVIDERS } from "../../domain/providers";
import { statusMeta } from "../../domain/status";
import { TASK_STATUS_LABELS } from "../../domain/tasks";
import StatusPill from "../common/StatusPill.vue";
import Swatch from "../common/Swatch.vue";
import Highlight from "./Highlight.vue";
import type { PaletteOptionModel } from "./paletteOptionModel";

const props = defineProps<{ option: PaletteOptionModel; domId: string; active: boolean; query: string }>();
const emit = defineEmits<{ hover: []; run: [] }>();
const disabled = computed(() => props.option.kind === "action" && props.option.action.disabled === true);
const tint = computed(() =>
  props.option.kind === "agent" ? { "--tint": cssVar(statusMeta(props.option.session.status).color) } : undefined,
);

function projectName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
</script>

<!--
  listbox option: hover moves the cursor, click runs it; focus stays in the input.
  Agent: status dot · title · `provider · model · ~/dir` · status pill.
  Action: icon tile (or provider swatch) · label · optional context hint.
-->
<template>
  <div
    :id="domId"
    role="option"
    :aria-selected="active"
    :aria-disabled="disabled ? 'true' : undefined"
    class="option"
    :style="tint"
    @pointermove="!active && emit('hover')"
    @mousedown.prevent
    @click="!disabled && emit('run')"
  >
    <template v-if="option.kind === 'agent'">
      <span class="dot" :data-status="option.session.status" aria-hidden="true" />
      <span class="main">
        <span class="label"><Highlight :text="option.session.title" :query="query" /></span>
        <span class="sub">{{ PROVIDERS[option.session.provider].label }} · {{ option.session.model ?? "unknown model" }} · {{ tildify(option.session.cwd) }}</span>
      </span>
      <StatusPill :status="option.session.status" />
    </template>
    <template v-else-if="option.kind === 'task'">
      <span class="tile">
        <SquareTerminal :size="16" aria-hidden="true" />
      </span>
      <span class="main">
        <span class="label"><Highlight :text="option.task.title" :query="query" /></span>
        <span class="sub">
          #{{ option.task.id }} · {{ projectName(option.projectPath) }} · {{ TASK_STATUS_LABELS[option.task.status] }}
        </span>
      </span>
      <span class="hint">
        {{ option.task.worktreePath ? "Open terminal" : "No worktree · Go to Tasks" }}
      </span>
    </template>
    <template v-else>
      <span class="tile">
        <Swatch v-if="option.action.color" :color="option.action.color" />
        <component :is="option.action.Icon" v-else :size="16" aria-hidden="true" />
      </span>
      <span class="main">
        <span class="label"><Highlight :text="option.action.label" :query="query" /></span>
      </span>
      <span v-if="option.action.hint" class="hint">{{ option.action.hint }}</span>
    </template>
  </div>
</template>

<style scoped>
.option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 7px 12px;
  border-radius: 12px;
  cursor: pointer;
  scroll-margin: 34px 0 8px;
}

.option[aria-selected="true"] {
  background: var(--fill-hover);
}

.option[aria-disabled="true"] {
  cursor: not-allowed;
}

.option[aria-disabled="true"] .label {
  color: var(--text-2);
}

.dot {
  width: 8px;
  height: 8px;
  margin: 0 12px;
  flex: none;
  border-radius: 50%;
  background: var(--tint);
  box-shadow: 0 0 8px color-mix(in srgb, var(--tint) 60%, transparent);
}

.dot[data-status="awaitingApproval"] {
  animation: urgent 1.2s ease-in-out infinite;
}

.tile {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--text-2);
  background: var(--fill-subtle);
  border: 1px solid var(--border);
  transition: color 140ms ease, border-color 140ms ease;
}

.option[aria-selected="true"] .tile {
  color: var(--text);
  border-color: var(--border-strong);
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label,
.sub,
.hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.label {
  font-size: 14px;
  font-weight: 500;
}

.sub {
  font-size: 12px;
  color: var(--text-3);
}

.hint {
  max-width: 200px;
  flex: none;
  font-size: 12px;
  color: var(--text-3);
}
@keyframes urgent {
  50% {
    opacity: 0.3;
  }
}
</style>
