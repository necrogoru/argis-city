import { readonly, ref, type Ref } from "vue";

interface HoverTarget {
  set(id: string): void;
  clear(id: string): void;
}

/**
 * One house is hovered while the pointer is on its mesh or on its DOM label.
 * The label's events arrive at once but the canvas's are processed on the
 * next rendered frame, so moving onto the label reports "label enter" before
 * "mesh out" — tracking both keeps the hover instead of clearing it.
 */
export function useHoverSources(
  id: () => string,
  hover: HoverTarget,
): {
  mesh: Readonly<Ref<boolean>>;
  meshOver(): void;
  meshOut(): void;
  labelEnter(): void;
  labelLeave(): void;
} {
  const mesh = ref(false);
  const label = ref(false);

  // Only real transitions touch the store, so a leave that never had an
  // enter cannot clear a hover set elsewhere (the agent-list row).
  function toggle(source: Ref<boolean>, on: boolean): void {
    if (source.value === on) return;
    source.value = on;
    if (mesh.value || label.value) hover.set(id());
    else hover.clear(id());
  }

  return {
    mesh: readonly(mesh),
    meshOver: () => toggle(mesh, true),
    meshOut: () => toggle(mesh, false),
    labelEnter: () => toggle(label, true),
    labelLeave: () => toggle(label, false),
  };
}
