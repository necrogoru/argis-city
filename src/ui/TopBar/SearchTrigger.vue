<script setup lang="ts">
import { ref } from "vue";
import { Search } from "@lucide/vue";
import { MOD_KEY_ARIA, MOD_KEY_LABEL, useModKey } from "../../composables/useModKey";
import CommandPalette from "../CommandPalette/CommandPalette.vue";
import Kbd from "../common/Kbd.vue";

const open = ref(false);
useModKey("k", () => (open.value = !open.value));
</script>

<!-- Search field look-alike in the top bar; click or ⌘K opens the command palette. -->
<template>
  <button
    type="button"
    class="glass trigger"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-keyshortcuts="`${MOD_KEY_ARIA}+K`"
    @click="open = true"
  >
    <Search :size="16" aria-hidden="true" />
    <span class="placeholder">Search agents &amp; actions</span>
    <Kbd>{{ MOD_KEY_LABEL }}K</Kbd>
  </button>
  <CommandPalette v-model:open="open" />
</template>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 260px;
  height: 48px;
  padding: 0 12px 0 16px;
  border-radius: var(--radius-button);
  color: var(--text-3);
  text-align: left;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.trigger:hover,
.trigger[aria-expanded="true"] {
  color: var(--text-2);
  border-color: var(--border-strong);
  background-color: #181b1df0;
}

.placeholder {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
