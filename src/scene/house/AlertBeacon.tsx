import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { beaconGeometry, HOUSE_TOP } from "../geometries";
import { beaconMaterial } from "../materials";

const HOVER_Y = HOUSE_TOP + 0.5;

/** "Needs you": an amber diamond that bobs and spins above the roof. */
export function AlertBeacon({ phase }: { phase: number }) {
  const diamond = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!diamond.current) return;
    const t = clock.elapsedTime;
    diamond.current.position.y = HOVER_Y + Math.sin(t * 2.4 + phase) * 0.07;
    diamond.current.rotation.y = t * 1.8;
  });

  return (
    <mesh
      ref={diamond}
      geometry={beaconGeometry}
      material={beaconMaterial}
      position-y={HOVER_Y}
      scale={[1, 1.55, 1]}
    />
  );
}
