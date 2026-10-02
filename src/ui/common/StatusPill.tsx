import type { CSSProperties } from "react";
import type { AgentStatus } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { statusMeta } from "../../domain/status";
import { StatusIcon } from "./StatusIcon";
import styles from "./StatusPill.module.css";

/** Icon + label tinted by status (Running, Needs approval, Idle, Done, Error). */
export function StatusPill({ status }: { status: AgentStatus }) {
  const meta = statusMeta(status);
  const tint = { "--tint": cssVar(meta.color) } as CSSProperties;
  return (
    <span className={styles.pill} style={tint} data-status={status}>
      <StatusIcon icon={meta.icon} className={styles.icon} />
      {meta.label}
    </span>
  );
}
