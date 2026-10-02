import type { CSSProperties } from "react";
import type { AgentStatus } from "../../domain/types";
import { visibleChips, type StatusCount, type StatusFilter } from "../../domain/agentList";
import { cssVar } from "../../domain/palette";
import { statusMeta } from "../../domain/status";
import styles from "./StatusChips.module.css";

interface StatusChipsProps {
  counts: readonly StatusCount[];
  filter: StatusFilter;
  onToggle: (status: AgentStatus) => void;
}

/** Running · Needs you · Idle · Done · Error — non-zero only; click to filter. */
export function StatusChips({ counts, filter, onToggle }: StatusChipsProps) {
  const chips = visibleChips(counts, filter);
  if (chips.length === 0) return null;

  return (
    <div className={styles.chips} role="group" aria-label="Filter by status">
      {chips.map(({ status, count }) => {
        const meta = statusMeta(status);
        return (
          <button
            key={status}
            type="button"
            className={styles.chip}
            style={{ "--tint": cssVar(meta.color) } as CSSProperties}
            aria-pressed={filter === status}
            data-dimmed={filter != null && filter !== status}
            onClick={() => onToggle(status)}
          >
            <span className={styles.dot} aria-hidden />
            {meta.chipLabel}
            <span className={styles.count}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
