<script setup lang="ts">
import { ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { Check, Copy, FolderOpen, Terminal } from "@lucide/vue";
import { useAgentSource } from "../../composables/useAgentSource";
import { useTerminalNavigationStore } from "../../stores/terminalNavigation";

const props = defineProps<{ cwd: string; terminalTaskId: number | null }>();
const source = useAgentSource();
const terminalNavigation = useTerminalNavigationStore();
const copied = ref(false);
const { start: resetCopiedLater } = useTimeoutFn(() => (copied.value = false), 1_500, { immediate: false });

function openFolder(): void {
  source.openPath(props.cwd).catch((error: unknown) => console.error("[argis] open_path failed", error));
}
function copyPath(): void {
  navigator.clipboard?.writeText(props.cwd).then(
    () => {
      copied.value = true;
      resetCopiedLater();
    },
    () => (copied.value = false),
  );
}

function openTerminal(): void {
  if (props.terminalTaskId == null) return;
  terminalNavigation.openTaskTerminal(props.terminalTaskId);
}
</script>

<!-- Selected-house actions: reveal/copy its cwd and, when eligible, open its task terminal. -->
<template>
  <div class="actions">
    <button type="button" class="primary" @click="openFolder"><FolderOpen :size="16" aria-hidden="true" />Open folder</button>
    <button v-if="terminalTaskId != null" type="button" class="terminal" @click="openTerminal">
      <Terminal :size="16" aria-hidden="true" />Terminal
    </button>
    <button
      type="button"
      class="ghost"
      :aria-label="copied ? 'Path copied' : 'Copy directory path'"
      title="Copy directory path"
      @click="copyPath"
    >
      <Check v-if="copied" :size="16" aria-hidden="true" />
      <Copy v-else :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 10px;
}

.primary {
  flex: 1;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-button);
  background: var(--teal);
  color: var(--text-on-accent);
  font-weight: 600;
  box-shadow: 0 0 22px rgba(50, 243, 226, 0.25);
  transition: filter 140ms ease, box-shadow 140ms ease;
}

.primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 0 28px rgba(50, 243, 226, 0.4);
}

.primary:active {
  transform: translateY(1px);
}

.ghost {
  width: 46px;
  height: 46px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-button);
  border: 1px solid var(--border);
  background: var(--fill-subtle);
  color: var(--text-2);
}

.terminal {
  min-height: 46px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  background: var(--fill-subtle);
  color: var(--text-2);
  font-weight: 500;
  transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.terminal:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--fill-hover);
}

.ghost:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
</style>
