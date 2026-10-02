import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { HouseVisual } from "../../domain/houseVisuals";
import { AlertBeacon } from "./AlertBeacon";
import { DoneHalo } from "./DoneHalo";
import { RoofSparks } from "./RoofSparks";

const GROW_S = 0.35;

/** Eases its children from scale 0 → 1 on mount, so beacons never pop in. */
function GrowIn({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    start.current ??= clock.elapsedTime;
    const p = Math.min(1, (clock.elapsedTime - start.current) / GROW_S);
    group.current.scale.setScalar(1 - Math.pow(1 - p, 3));
  });
  return (
    <group ref={group} scale={0}>
      {children}
    </group>
  );
}

/** The status-specific effect above a house: sparks, alert diamond or done halo. */
export function HouseBeacon({ visual, phase }: { visual: HouseVisual; phase: number }) {
  switch (visual.beacon) {
    case "sparks":
      return <RoofSparks hex={visual.hex} phase={phase} />;
    case "alert":
      return (
        <GrowIn key="alert">
          <AlertBeacon phase={phase} />
        </GrowIn>
      );
    case "halo":
      return (
        <GrowIn key="halo">
          <DoneHalo />
        </GrowIn>
      );
    default:
      return null;
  }
}
