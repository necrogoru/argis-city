import { memo, useRef, useState, type Ref } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { ProviderMeta } from "../domain/providers";
import type { DistrictState } from "./cityModel";
import { roofPanelGeometry, TOWER, towerStripGeometry, unitBox } from "./geometries";
import { GLOW_BASE_COLOR, plinthMaterial, towerBodyMaterial, towerCrownMaterial } from "./materials";
import { CLICK_TOLERANCE_PX } from "./Ground";
import { TowerLabel } from "./TowerLabel";

interface TowerProps {
  meta: ProviderMeta;
  height: number;
  count: number;
  state: DistrictState;
  highlighted: boolean;
  onFocus: (meta: ProviderMeta) => void;
  /** Body mesh, used to fade house labels hidden behind the tower. */
  bodyRef?: Ref<Mesh>;
}

/** Provider tower: matte body, emissive strips and roof panels, eased height. */
export const Tower = memo(function Tower(props: TowerProps) {
  const { meta, height, count, state, highlighted, onFocus, bodyRef } = props;
  const body = useRef<Group>(null);
  const top = useRef<Group>(null);
  const strips = useRef<MeshStandardMaterial>(null);
  const panels = useRef<MeshStandardMaterial>(null);
  const [initialHeight] = useState(height);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame(({ clock }, delta) => {
    if (!body.current || !top.current) return;
    const h = body.current.scale.y + (height - body.current.scale.y) * (1 - Math.exp(-delta * 4));
    body.current.scale.y = h;
    top.current.position.y = h;
    const base = state === "live" ? 1.6 + 0.2 * Math.sin(clock.elapsedTime * 1.3) : state === "empty" ? 0.22 : 0.08;
    const boost = hovered || highlighted ? 1.3 : 1;
    if (strips.current) strips.current.emissiveIntensity = base * boost;
    if (panels.current) panels.current.emissiveIntensity = base * 1.4 * boost;
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta <= CLICK_TOLERANCE_PX) onFocus(meta);
  };
  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
  };

  return (
    <group onClick={onClick} onPointerOver={onPointerOver} onPointerOut={() => setHovered(false)}>
      <mesh
        geometry={unitBox}
        material={plinthMaterial}
        scale={[TOWER.plinth, 0.12, TOWER.plinth]}
        position-y={0.06}
        receiveShadow
      />
      <group ref={body} scale-y={initialHeight}>
        <mesh
          ref={bodyRef}
          geometry={unitBox}
          material={towerBodyMaterial}
          scale={[TOWER.width, 1, TOWER.width]}
          position-y={0.5}
          castShadow
          receiveShadow
        />
        <mesh geometry={towerStripGeometry}>
          <meshStandardMaterial ref={strips} color={GLOW_BASE_COLOR} emissive={meta.hex} toneMapped={false} />
        </mesh>
      </group>
      <group ref={top} position-y={initialHeight}>
        <mesh
          geometry={unitBox}
          material={towerCrownMaterial}
          scale={[TOWER.crown, TOWER.crownHeight, TOWER.crown]}
          position-y={TOWER.crownHeight / 2}
          castShadow
        />
        <mesh geometry={roofPanelGeometry} position-y={TOWER.crownHeight + 0.02}>
          <meshStandardMaterial ref={panels} color={GLOW_BASE_COLOR} emissive={meta.hex} toneMapped={false} />
        </mesh>
        <TowerLabel
          position={[0, TOWER.crownHeight + 0.1, 0]}
          meta={meta}
          count={count}
          state={state}
          highlighted={highlighted}
          onFocus={onFocus}
        />
      </group>
    </group>
  );
});
