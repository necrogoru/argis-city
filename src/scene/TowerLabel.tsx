import type { CSSProperties } from "react";
import { Html } from "@react-three/drei";
import type { ProviderMeta } from "../domain/providers";
import type { DistrictState } from "./cityModel";
import { useLabelLayer } from "./LabelLayer";
import styles from "./TowerLabel.module.css";

interface TowerLabelProps {
  position: [number, number, number];
  meta: ProviderMeta;
  count: number;
  state: DistrictState;
  highlighted: boolean;
  onFocus: (meta: ProviderMeta) => void;
}

const NOTES: Readonly<Record<DistrictState, string | null>> = {
  live: null,
  empty: "No live sessions",
  unavailable: "Not installed",
};

/**
 * In-scene glass pill anchored to the tower top. Rendered by drei `Html` in its
 * own React root, so it only receives plain props (no context).
 */
export function TowerLabel({ position, meta, count, state, highlighted, onFocus }: TowerLabelProps) {
  const portal = useLabelLayer();
  const note = NOTES[state];
  const accent = { "--accent": meta.hex } as CSSProperties;

  return (
    <Html position={position} portal={portal} zIndexRange={[50, 41]}>
      <div className={styles.root} style={accent} data-state={state}>
        <button
          type="button"
          className={styles.pill}
          data-highlighted={highlighted}
          aria-label={`Focus ${meta.label} district, ${count} live sessions`}
          onClick={() => onFocus(meta)}
        >
          <span className={styles.swatch} />
          <span className={styles.name}>{meta.label}</span>
          <span className={styles.count}>{count}</span>
        </button>
        {note && <span className={styles.note}>{note}</span>}
        <span className={styles.line} />
        <span className={styles.dot} />
      </div>
    </Html>
  );
}
