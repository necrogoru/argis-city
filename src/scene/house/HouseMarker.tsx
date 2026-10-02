import { Html } from "@react-three/drei";
import { House } from "lucide-react";
import { formatPercent } from "../../domain/format";
import { useLabelLayer } from "../LabelLayer";
import styles from "./HouseMarker.module.css";

interface HouseMarkerProps {
  position: [number, number, number];
  title: string;
  percent: number | null;
}

/** Solid teal callout above the selected house: `title · 68%`, line, ring. */
export function HouseMarker({ position, title, percent }: HouseMarkerProps) {
  const portal = useLabelLayer();
  return (
    <Html position={position} portal={portal} zIndexRange={[60, 51]}>
      <div className={styles.root}>
        <div className={styles.callout}>
          <span className={styles.tile}>
            <House size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{title}</span>
            {percent != null && <span className={styles.percent}>· {formatPercent(percent)}</span>}
          </span>
        </div>
        <span className={styles.line} />
        <span className={styles.ring} />
      </div>
    </Html>
  );
}
