import { onBeforeUnmount, watch, type Ref } from "vue";

/** Pointer cursor while `hovered`; back to `auto` on leave or unmount. */
export function useCursor(hovered: Readonly<Ref<boolean>>): void {
  watch(hovered, (on) => {
    document.body.style.cursor = on ? "pointer" : "auto";
  });
  onBeforeUnmount(() => {
    if (hovered.value) document.body.style.cursor = "auto";
  });
}
