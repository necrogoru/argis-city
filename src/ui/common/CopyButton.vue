<script setup lang="ts">
import { ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { AlertCircle, Check, Copy } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    label: string;
    copiedLabel: string;
    copy: () => Promise<void>;
    showLabel?: boolean;
    disabled?: boolean;
  }>(),
  { showLabel: false, disabled: false },
);
const status = ref<"idle" | "copied" | "failed">("idle");
const error = ref("");
const { start: resetLater } = useTimeoutFn(() => (status.value = "idle"), 1_500, { immediate: false });

async function run(): Promise<void> {
  try {
    await props.copy();
    status.value = "copied";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    status.value = "failed";
  }
  resetLater();
}
</script>

<template>
  <span class="copy">
    <button
      class="copy-button"
      :class="{ 'copy-button--icon': !props.showLabel }"
      type="button"
      :disabled="props.disabled"
      :aria-label="status === 'copied' ? props.copiedLabel : props.label"
      :title="status === 'failed' ? error : props.label"
      @click="run"
    >
      <Check v-if="status === 'copied'" :size="16" aria-hidden="true" />
      <AlertCircle v-else-if="status === 'failed'" :size="16" aria-hidden="true" />
      <Copy v-else :size="16" aria-hidden="true" />
      <span v-if="props.showLabel">{{ status === "copied" ? props.copiedLabel : status === "failed" ? "Copy failed" : props.label }}</span>
    </button>
    <span v-if="status === 'failed' && props.showLabel === false" class="copy-error" role="alert">{{ error }}</span>
  </span>
</template>

<style scoped>
.copy {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--fill-subtle);
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}

.copy-button--icon {
  width: 34px;
  padding: 0;
}

.copy-button:hover:not(:disabled) {
  background: var(--fill-hover);
  color: var(--text);
}

.copy-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.copy-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.copy-error {
  color: var(--red);
  font-size: 11px;
}
</style>
