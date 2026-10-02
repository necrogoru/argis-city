import type { ReactNode } from "react";
import { useSelectedSession } from "../state/useSelectedSession";
import styles from "./Overlay.module.css";

/**
 * Full-window UI layer above the canvas. Click-through by default; panels opt
 * back in. Exposes `--strip-space` so siblings can clear the subagent strip.
 */
export function Overlay({ children }: { children: ReactNode }) {
  const selected = useSelectedSession();
  const hasStrip = !!selected && selected.session.subagents.length > 0;
  return (
    <div className={styles.overlay} data-strip={hasStrip}>
      <div className={styles.scrim} aria-hidden />
      {children}
    </div>
  );
}
