import { onBeforeUnmount, watch, type Ref } from "vue";

/** Pointer cursor while `hovered`; back to `auto` on leave or unmount. */
export function useCursor(hovered: Readonly<Ref<boolean>>): void {
  // Sync, so leave-then-enter in one pointer commit applies in that order (a
  // queued watcher runs in component order: the tower before its houses).
  watch(
    hovered,
    (on) => {
      document.body.style.cursor = on ? "pointer" : "auto";
    },
    { flush: "sync" },
  );
  onBeforeUnmount(() => {
    if (hovered.value) document.body.style.cursor = "auto";
  });
}
