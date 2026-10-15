<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { PROVIDERS } from "../../domain/providers";
import type { TerminalAgent, TerminalSize, TerminalTab } from "../../domain/types";
import { useAgentSource } from "../../composables/useAgentSource";
import TerminalSurface from "./TerminalSurface.vue";
import { useTerminalSession, type TerminalStatus } from "./useTerminalSession";

const props = defineProps<{
  taskId: number;
  tab: TerminalTab;
  active: boolean;
  restoring: boolean;
  panelId: string;
  tabId: string;
}>();

const emit = defineEmits<{
  statusChange: [status: TerminalStatus];
}>();

interface TerminalRenderer {
  fit: () => TerminalSize | null;
  write: (data: string | Uint8Array) => void;
  focus: () => void;
}

const source = useAgentSource();
const surface = useTemplateRef<TerminalRenderer>("surface");
const selectedAgent = ref<TerminalAgent>("claude");
const session = useTerminalSession({
  source,
  taskId: props.taskId,
  tab: props.tab,
  getSize: () => surface.value?.fit() ?? null,
  write: (bytes) => surface.value?.write(bytes),
});
const displayedAgent = computed(() => session.attachment.value?.session.agentCli ?? selectedAgent.value);

function statusLabel(status: TerminalStatus): string {
  switch (status) {
    case "notStarted": return "Not started";
    case "starting": return "Starting";
    case "running": return "Running";
    case "exited": return "Exited";
    case "error": return "Unavailable";
  }
}

async function reattach(): Promise<void> {
  await session.reattach();
  const agentCli = session.attachment.value?.session.agentCli;
  if (props.tab === "agent" && agentCli) selectedAgent.value = agentCli;
  if (props.tab === "agent" && session.resumeReference.value) {
    selectedAgent.value = session.resumeReference.value.provider;
  }
}

async function start(): Promise<void> {
  await session.start(props.tab === "agent" ? selectedAgent.value : null);
  if (session.connected.value) surface.value?.focus();
}

async function resume(): Promise<void> {
  await session.resume();
  if (session.connected.value) surface.value?.focus();
}

function fit(): void {
  surface.value?.fit();
}

function focus(): void {
  if (!props.active) return;
  surface.value?.focus();
}

watch(session.status, (status) => emit("statusChange", status), { immediate: true });
onBeforeUnmount(() => void session.dispose());

defineExpose({ reattach, detach: session.detach, fit, focus, start });
</script>

<template>
  <section
    :id="props.panelId"
    class="terminal-session-pane"
    role="tabpanel"
    :aria-labelledby="props.tabId"
    :aria-hidden="!props.active"
    :inert="!props.active"
    :data-active="props.active"
    tabindex="0"
  >
    <div class="terminal-session-toolbar">
      <div v-if="props.tab === 'agent' && session.status.value !== 'running' && session.status.value !== 'starting'" class="terminal-agent-controls">
        <p v-if="session.resumeLookupComplete.value && session.resumeUnavailable.value" class="terminal-resume-unavailable" role="status">
          Resume unavailable — no valid saved conversation for this task.
        </p>
        <span v-if="session.resumeReference.value" class="terminal-resume-label">
          Saved conversation · {{ PROVIDERS[session.resumeReference.value.provider].label }}
        </span>
        <button
          v-if="session.resumeReference.value && !session.resumeUnavailable.value"
          type="button"
          :disabled="props.restoring"
          @click="resume"
        >
          Resume {{ PROVIDERS[session.resumeReference.value.provider].label }}
        </button>
        <label :for="`agent-choice-${props.taskId}`">New conversation</label>
        <select :id="`agent-choice-${props.taskId}`" v-model="selectedAgent" :disabled="props.restoring">
          <option value="claude">Claude Code</option>
          <option value="codex">Codex</option>
          <option value="opencode">OpenCode</option>
          <option value="pi">Pi</option>
        </select>
        <button type="button" aria-keyshortcuts="s" :disabled="props.restoring" @click="start">Start new</button>
      </div>
      <button
        v-else-if="props.tab === 'term' && session.status.value !== 'running' && session.status.value !== 'starting'"
        type="button"
        aria-keyshortcuts="s"
        :disabled="props.restoring"
        @click="start"
      >
        Start shell
      </button>
      <span v-else class="terminal-session-status" role="status" aria-live="polite">
        {{ props.tab === 'agent' ? PROVIDERS[displayedAgent].label : 'Shell' }} · {{ statusLabel(session.status.value) }}
      </span>
      <p v-if="session.error.value" class="terminal-session-error" role="alert">{{ session.error.value }}</p>
    </div>
    <div class="terminal-surface-wrap">
      <TerminalSurface
        ref="surface"
        :label="props.tab === 'agent' ? 'Agent terminal' : 'Shell terminal'"
        :active="props.active"
        :connected="session.connected.value"
        @data="session.sendInput"
        @resize="session.resize"
      />
    </div>
  </section>
</template>

<style scoped src="./TerminalSessionPane.css"></style>
