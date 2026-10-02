import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, type MeshBasicMaterial } from "three";
import { ringPulse } from "../../domain/houseVisuals";
import { pulseRingGeometry } from "../geometries";

interface GroundPulseProps {
  hex: string;
  /** Loop forever (needs you) or play once (~1 s ripple when a session finishes). */
  loop?: boolean;
}

const LOOP_PERIOD_S = 1.8;
const ONCE_PERIOD_S = 1;

/** Expanding, fading ground ring(s) around a house lot. */
export function GroundPulse({ hex, loop = false }: GroundPulseProps) {
  const rings = useRef<(Mesh | null)[]>([]);
  const start = useRef<number | null>(null);
  const color = useMemo(() => new Color(hex).multiplyScalar(1.8), [hex]);
  const count = loop ? 2 : 1;

  useFrame(({ clock }) => {
    start.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - start.current;
    rings.current.forEach((mesh, i) => {
      if (!mesh) return;
      const raw = loop ? elapsed / LOOP_PERIOD_S + i / count : elapsed / ONCE_PERIOD_S;
      const { scale, opacity } = ringPulse(loop ? raw % 1 : raw);
      mesh.visible = loop || raw < 1;
      mesh.scale.setScalar(scale);
      (mesh.material as MeshBasicMaterial).opacity = opacity * 0.85;
    });
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            rings.current[i] = mesh;
          }}
          geometry={pulseRingGeometry}
          position-y={0.05}
          renderOrder={2}
        >
          <meshBasicMaterial color={color} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
