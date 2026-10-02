import { memo, useState, type CSSProperties, type RefObject } from "react";
import { Html } from "@react-three/drei";
import type { Object3D } from "three";
import type { AgentStatus } from "../../domain/types";
import { truncateLabel } from "../../domain/format";
import { statusHex } from "../../domain/status";
import { HOUSE_TOP } from "../geometries";
import { useLabelLayer } from "../LabelLayer";
import styles from "./HouseLabel.module.css";

/** World height above the roof: leaves room for beacons / halos underneath. */
const LABEL_Y = HOUSE_TOP + 0.95;

interface HouseLabelProps {
  title: string;
  status: AgentStatus;
  /** Resting opacity (dimmer for idle / done). */
  opacity: number;
  hovered: boolean;
  /** Extra px lift to de-collide mirror-image neighbours. */
  lift: number;
  onSelect: () => void;
  onEnter: () => void;
  onLeave: () => void;
  /** Label fades (not hides) while one of these is between it and the camera. */
  occluders: RefObject<Object3D>[];
}

/**
 * Always-visible name pill above a house. Pointer convenience only (the agent
 * list is the keyboard path), so it is hidden from assistive tech.
 */
export const HouseLabel = memo(function HouseLabel(props: HouseLabelProps) {
  const { title, status, opacity, hovered, lift, onSelect, onEnter, onLeave, occluders } = props;
  const portal = useLabelLayer();
  const [occluded, setOccluded] = useState(false);
  const style = {
    "--dot": statusHex(status),
    "--lift": `${lift}px`,
    "--rest-opacity": opacity,
  } as CSSProperties;

  return (
    <Html
      position={[0, LABEL_Y, 0]}
      portal={portal}
      zIndexRange={[40, 0]}
      occlude={occluders}
      onOcclude={setOccluded}
    >
      <div
        className={styles.label}
        style={style}
        data-status={status}
        data-hovered={hovered}
        data-occluded={occluded}
        title={title}
        aria-hidden
        onClick={onSelect}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <span className={styles.dot} />
        <span className={styles.text}>{truncateLabel(title)}</span>
      </div>
    </Html>
  );
});
