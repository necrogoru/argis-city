<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { CircleAlert, Radar } from "@lucide/vue";
import type { Snapshot } from "../domain/types";
import { useSnapshotStore } from "../stores/snapshot";

interface Message {
  title: string;
  body: string;
  tone: "info" | "error";
  retry?: boolean;
}

function messageFor(snapshot: Snapshot | null, error: string | null): Message | null {
  if (!snapshot) {
    return error
      ? { title: "Can't reach the Argis backend", body: error, tone: "error", retry: true }
      : { title: "Scanning for agents…", body: "Looking for Claude Code, Codex, OpenCode and Pi sessions.", tone: "info" };
  }
  if (snapshot.sessions.length > 0) return null;
  const installed = snapshot.providers.some((p) => p.available);
  if (snapshot.providers.length > 0 && !installed) {
    return {
      title: "No supported agent tools found",
      body: "Install Claude Code, Codex, OpenCode or Pi — their towers light up here as soon as a session starts.",
      tone: "info",
    };
  }
  return null; // "no live agents" is shown inside the Agents list
}

const snapshots = useSnapshotStore();
const { snapshot, error } = storeToRefs(snapshots);
const message = computed(() => messageFor(snapshot.value, error.value));
</script>

<!-- Loading, backend-error and "no agent tools installed" states. -->
<template>
  <div v-if="message" class="glass card" :data-tone="message.tone" role="status">
    <component :is="message.tone === 'error' ? CircleAlert : Radar" :size="20" class="icon" aria-hidden="true" />
    <div class="text">
      <p class="title">{{ message.title }}</p>
      <p class="body">{{ message.body }}</p>
    </div>
    <button v-if="message.retry" type="button" class="retry" @click="snapshots.refresh()">Retry</button>
  </div>
</template>

<style scoped>
.card {
  --tone: var(--teal);
  position: absolute;
  left: 50%;
  bottom: calc(var(--gutter) + 8px);
  transform: translateX(-50%);
  max-width: min(520px, calc(100% - 2 * var(--gutter)));
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--radius-card);
  pointer-events: auto;
}

.card[data-tone="error"] {
  --tone: var(--red);
  border-color: color-mix(in srgb, var(--red) 30%, transparent);
}

.icon {
  flex: none;
  color: var(--tone);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.title {
  font-size: 14px;
  font-weight: 500;
}

.body {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-2);
}

.retry {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--fill-hover);
  font-weight: 500;
}
</style>
