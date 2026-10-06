<script setup lang="ts">
import { ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { Check, Copy, FolderOpen } from "@lucide/vue";
import { useAgentSource } from "../../composables/useAgentSource";

const props = defineProps<{ cwd: string }>();
const source = useAgentSource();
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
</script>

<!-- Primary "Open folder" (reveals cwd via the backend) + copy-path ghost button. -->
<template>
  <div class="actions">
    <button type="button" class="primary" @click="openFolder"><FolderOpen :size="16" aria-hidden="true" />Open folder</button>
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

.ghost:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
</style>
