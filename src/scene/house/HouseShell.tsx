import { useRef, useState } from "react";
import type { MeshStandardMaterial } from "three";
import type { HouseVisual } from "../../domain/houseVisuals";
import {
  HOUSE,
  houseKeyWindowGeometry,
  houseRestWindowGeometry,
  roofGeometry,
  unitBox,
} from "../geometries";
import { GLOW_BASE_COLOR, lotMaterial } from "../materials";
import { useHouseGlow } from "./useHouseGlow";

interface HouseShellProps {
  visual: HouseVisual;
  phase: number;
  hovered: boolean;
}

/** Lot, matte body, pyramid roof and windows — lit and animated by status. */
export function HouseShell({ visual, phase, hovered }: HouseShellProps) {
  const keyWindows = useRef<MeshStandardMaterial>(null);
  const restWindows = useRef<MeshStandardMaterial>(null);
  const roof = useRef<MeshStandardMaterial>(null);
  const body = useRef<MeshStandardMaterial>(null);
  // Mount with the right colours; afterwards useHouseGlow eases every change.
  const [initial] = useState(visual);
  useHouseGlow({ keyWindows, restWindows, roof, body }, visual, phase, hovered);

  return (
    <>
      <mesh
        geometry={unitBox}
        material={lotMaterial}
        scale={[HOUSE.lot, 0.05, HOUSE.lot]}
        position-y={0.025}
        receiveShadow
      />
      <mesh
        geometry={unitBox}
        scale={[HOUSE.width, HOUSE.height, HOUSE.width]}
        position-y={HOUSE.height / 2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial ref={body} color={initial.bodyHex} roughness={0.88} metalness={0.12} />
      </mesh>
      <mesh geometry={houseKeyWindowGeometry}>
        <meshStandardMaterial ref={keyWindows} color={GLOW_BASE_COLOR} emissive={initial.hex} toneMapped={false} />
      </mesh>
      <mesh geometry={houseRestWindowGeometry}>
        <meshStandardMaterial ref={restWindows} color={GLOW_BASE_COLOR} emissive={initial.hex} toneMapped={false} />
      </mesh>
      <mesh geometry={roofGeometry} castShadow>
        <meshStandardMaterial ref={roof} color="#202427" roughness={0.75} emissive={initial.hex} toneMapped={false} />
      </mesh>
    </>
  );
}
