import { Grid } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

/** Pointer travel (px) above which a click is treated as a camera drag. */
export const CLICK_TOLERANCE_PX = 6;

/** Matte black ground with faint street lines; clicking it deselects. */
export function Ground({ onDeselect }: { onDeselect: () => void }) {
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta <= CLICK_TOLERANCE_PX) onDeselect();
  };

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={onClick}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0C0E0F" roughness={1} metalness={0} />
      </mesh>
      {/* World-aligned grid reads as diagonal streets through the iso camera. */}
      <Grid
        position-y={0.004}
        args={[160, 160]}
        cellSize={1.75}
        cellThickness={0.6}
        cellColor="#121618"
        sectionSize={7}
        sectionThickness={1.1}
        sectionColor="#1B2124"
        fadeDistance={58}
        fadeStrength={1.6}
        fadeFrom={0}
        infiniteGrid
      />
    </group>
  );
}
