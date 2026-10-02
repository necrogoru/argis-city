import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  value: ReactNode;
  caption: ReactNode;
}

/** Small boxed metric: label, 24/500 value, caption. */
export function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.caption}>{caption}</span>
    </div>
  );
}
