import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const LIFT = 0.16;

/** Eases a house towards its lot (layout changes) and lifts it while hovered/selected. */
export function useHouseMotion(group: RefObject<Group | null>, x: number, z: number, lifted: boolean) {
  useFrame((_, delta) => {
    const p = group.current?.position;
    if (!p) return;
    const k = 1 - Math.exp(-delta * 7);
    const y = lifted ? LIFT : 0;
    p.set(p.x + (x - p.x) * k, p.y + (y - p.y) * k, p.z + (z - p.z) * k);
  });
}
