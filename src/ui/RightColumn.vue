<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import { storeToRefs } from "pinia";
import type { SelectedSession } from "../domain/session";
import { useSelectionStore } from "../stores/selection";
import AgentList from "./AgentList/AgentList.vue";
import AgentPanel from "./AgentPanel/AgentPanel.vue";

const selection = useSelectionStore();
const { selectedSession } = storeToRefs(selection);
const open = computed(() => selectedSession.value != null);

// Keep the panel's content while it fades out after the selection clears.
const shown = shallowRef<SelectedSession | null>(selectedSession.value);
watch(selectedSession, (next) => {
  if (next) shown.value = next;
});

// Keyboard focus follows the visible slot.
const listSlot = useTemplateRef<HTMLDivElement>("listSlot");
const panelSlot = useTemplateRef<HTMLDivElement>("panelSlot");
watch(
  open,
  (isOpen) => {
    const [from, to] = isOpen ? [listSlot.value, panelSlot.value] : [panelSlot.value, listSlot.value];
    const active = document.activeElement;
    if (active && from?.contains(active)) to?.querySelector<HTMLElement>("button")?.focus();
  },
  { flush: "post" },
);
</script>

<!--
  Right-hand column: the Agents list by default, the detail panel while a
  session is selected. Both stay mounted and crossfade (~200 ms); the hidden
  one is `inert`, and keyboard focus follows the visible one.
-->
<template>
  <div class="column">
    <div ref="listSlot" class="slot" data-kind="list" :data-active="!open" :inert="open">
      <AgentList />
    </div>
    <div ref="panelSlot" class="slot" data-kind="panel" :data-active="open" :inert="!open">
      <AgentPanel v-if="shown" :selected="shown" @back="selection.clearSession()" @close="selection.clearSession()" />
    </div>
  </div>
</template>

<style scoped>
.column {
  position: absolute;
  top: var(--content-top);
  right: var(--gutter);
  bottom: calc(var(--gutter) + var(--strip-space, 0px));
  width: var(--panel-w);
  pointer-events: none;
  transition: bottom 260ms var(--ease-out);
}

/* Both panels share the slot; height is capped by the column (above the strip). */
.slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  transition:
    opacity 200ms var(--ease-out),
    transform 200ms var(--ease-out),
    visibility 0s linear 200ms;
}

.slot[data-active="true"] {
  opacity: 1;
  transform: none;
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s;
}

.slot[data-active="false"] {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.slot[data-kind="list"][data-active="false"] {
  transform: translateX(-12px);
}

.slot[data-kind="panel"][data-active="false"] {
  transform: translateX(16px);
}
</style>
