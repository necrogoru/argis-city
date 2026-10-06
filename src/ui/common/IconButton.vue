<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Required: icon-only buttons need an accessible name. */
    label: string;
    shape?: "round" | "square";
    size?: number;
  }>(),
  { shape: "square", size: 44 },
);
</script>

<!-- Glass icon-only button (44px round camera controls, 48px square nav, …). -->
<template>
  <button
    type="button"
    class="glass button"
    :aria-label="label"
    :title="label"
    :data-shape="shape"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: grid;
  place-items: center;
  flex: none;
  color: var(--text-2);
  border-radius: var(--radius-button);
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.button[data-shape="round"] {
  border-radius: 50%;
}

.button:hover:not(:disabled):not([aria-disabled="true"]) {
  color: var(--text);
  border-color: var(--border-strong);
  background-color: #181b1df0;
}

.button:active:not(:disabled) {
  transform: translateY(1px);
}

.button[aria-disabled="true"] {
  opacity: 0.55;
}
</style>
