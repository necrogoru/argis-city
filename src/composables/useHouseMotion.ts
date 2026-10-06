import type { ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";

const LIFT = 0.16;

/** Eases a house towards its lot (layout changes) and lifts it while hovered/selected. */
export function useHouseMotion(
  group: Readonly<ShallowRef<Group | null>>,
  x: () => number,
  z: () => number,
  lifted: () => boolean,
): void {
  useLoop().onBeforeRender(({ delta }) => {
    const p = group.value?.position;
    if (!p) return;
    const k = 1 - Math.exp(-delta * 7);
    const y = lifted() ? LIFT : 0;
    const tx = x();
    const tz = z();
    p.set(p.x + (tx - p.x) * k, p.y + (y - p.y) * k, p.z + (tz - p.z) * k);
  });
}
