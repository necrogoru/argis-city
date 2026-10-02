import { memo, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import type { Group, Object3D } from "three";
import type { AgentStatus, ProviderId } from "../../domain/types";
import { PALETTE } from "../../domain/palette";
import { housePhase, houseVisual } from "../../domain/houseVisuals";
import { useHoverStore, useIsHovered } from "../../state/HoverContext";
import { HOUSE_TOP, selectionRingGeometry } from "../geometries";
import { selectionRingMaterial } from "../materials";
import { CLICK_TOLERANCE_PX } from "../Ground";
import { labelLift } from "../layout";
import { GroundPulse } from "./GroundPulse";
import { HouseBeacon } from "./HouseBeacon";
import { HouseLabel } from "./HouseLabel";
import { HouseMarker } from "./HouseMarker";
import { HouseShell } from "./HouseShell";
import { useDoneRipple } from "./useDoneRipple";
import { useHouseMotion } from "./useHouseMotion";

interface HouseProps {
  id: string;
  provider: ProviderId;
  status: AgentStatus;
  title: string;
  percent: number | null;
  /** 0-based index and ring within the district (label stagger). */
  index: number;
  ring: number;
  /** Target offset from the tower; the house eases towards it. */
  x: number;
  z: number;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Meshes (the district tower) that can hide this house's label. */
  occluders: RefObject<Object3D>[];
}

/** One live session: shell + status effects + name label (or marker when selected). */
export const House = memo(function House(props: HouseProps) {
  const { id, provider, status, title, percent, index, ring, x, z, selected, onSelect, occluders } = props;
  const group = useRef<Group>(null);
  const [initial] = useState<[number, number, number]>(() => [x, 0, z]);
  const [pointerOver, setPointerOver] = useState(false);
  const hover = useHoverStore();
  const hovered = useIsHovered(id);
  const visual = useMemo(() => houseVisual(status, provider), [status, provider]);
  const phase = useMemo(() => housePhase(id), [id]);
  const ripples = useDoneRipple(status);
  useCursor(pointerOver);
  useHouseMotion(group, x, z, hovered || selected);

  const select = useCallback(() => onSelect(id), [onSelect, id]);
  const enter = useCallback(() => hover.set(id), [hover, id]);
  const leave = useCallback(() => hover.clear(id), [hover, id]);
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta <= CLICK_TOLERANCE_PX) select();
  };

  return (
    <group
      ref={group}
      position={initial}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setPointerOver(true);
        enter();
      }}
      onPointerOut={() => {
        setPointerOver(false);
        leave();
      }}
    >
      <HouseShell visual={visual} phase={phase} hovered={hovered} />
      <HouseBeacon visual={visual} phase={phase} />
      {visual.groundPulse && <GroundPulse hex={visual.hex} loop />}
      {ripples > 0 && <GroundPulse key={ripples} hex={PALETTE.blue} />}
      {selected ? (
        <>
          <mesh geometry={selectionRingGeometry} material={selectionRingMaterial} position-y={0.06} />
          <HouseMarker position={[0, HOUSE_TOP + 0.05, 0]} title={title} percent={percent} />
        </>
      ) : (
        <HouseLabel
          title={title}
          status={status}
          opacity={visual.labelOpacity}
          hovered={hovered}
          lift={labelLift(index, ring)}
          onSelect={select}
          onEnter={enter}
          onLeave={leave}
          occluders={occluders}
        />
      )}
    </group>
  );
});
