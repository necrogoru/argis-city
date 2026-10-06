<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import PaletteBody from "./PaletteBody.vue";

const open = defineModel<boolean>("open", { required: true });
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
let pressedBackdrop = false;

watch(
  open,
  (isOpen, _previous, onCleanup) => {
    const el = dialog.value;
    if (!el || !isOpen) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    el.querySelector("input")?.focus();
    onCleanup(() => {
      el.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  },
  { flush: "post" },
);

function close(): void {
  open.value = false;
}
// Escape closes the palette only — preventDefault keeps the selection's Escape handler out of it.
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
}
// A stale `close` event (fired after a quick close → reopen) must not shut it again.
function onClose(event: Event): void {
  if (!(event.currentTarget as HTMLDialogElement).open) close();
}
function onMousedown(event: MouseEvent): void {
  pressedBackdrop = event.target === event.currentTarget;
}
function onClick(event: MouseEvent): void {
  if (pressedBackdrop && event.target === event.currentTarget) close();
}
</script>

<!--
  ⌘K modal: search live agents and run app actions. A native `<dialog>`
  (top layer, focus trap, inert background); focus returns to where it was.
-->
<template>
  <dialog
    ref="dialog"
    class="glass dialog"
    aria-label="Search agents and actions"
    @keydown="onKeydown"
    @close="onClose"
    @mousedown="onMousedown"
    @click="onClick"
  >
    <PaletteBody v-if="open" @close="close" />
  </dialog>
</template>

<style scoped>
/* Top-layer modal; the overlay is click-through, so opt back in explicitly. */
.dialog {
  pointer-events: auto;
  width: min(640px, calc(100vw - 48px));
  max-width: none;
  max-height: min(560px, calc(100vh - 176px));
  margin: 112px auto auto;
  padding: 0;
  border-radius: var(--radius-panel);
  color: var(--text);
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.dialog[open] {
  display: flex;
  flex-direction: column;
  animation: rise 180ms var(--ease-out);
}

.dialog::backdrop {
  background: rgba(10, 11, 12, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: fade 180ms ease-out;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
