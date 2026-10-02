import { memo, type CSSProperties } from "react";
import { GitFork } from "lucide-react";
import type { AgentSession } from "../../domain/types";
import { formatPercent } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { clampPercent } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import { useHoverStore, useIsHovered } from "../../state/HoverContext";
import { Elapsed } from "../common/Elapsed";
import styles from "./AgentRow.module.css";

interface AgentRowProps {
  session: AgentSession;
  onSelect: (id: string) => void;
}

/** Status accent + dot, title, `model · elapsed`, progress % and subagent badge. */
export const AgentRow = memo(function AgentRow({ session, onSelect }: AgentRowProps) {
  const { id, status, title, model, subagents } = session;
  const hover = useHoverStore();
  const hovered = useIsHovered(id);
  const meta = statusMeta(status);
  const enter = () => hover.set(id);
  const leave = () => hover.clear(id);

  return (
    <li>
      <button
        type="button"
        className={styles.row}
        style={{ "--tint": cssVar(meta.color) } as CSSProperties}
        data-status={status}
        data-hovered={hovered}
        onClick={() => onSelect(id)}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
      >
        <span className={styles.accent} aria-hidden />
        <span className={styles.dot} aria-hidden />
        <span className={styles.main}>
          <span className={styles.title}>{title}</span>
          <span className={styles.sub}>
            {model ?? "unknown model"} · <Elapsed item={session} />
          </span>
        </span>
        <span className={styles.side}>
          <span className={styles.percent}>{formatPercent(clampPercent(session.progress.percent))}</span>
          {subagents.length > 0 && (
            <span className={styles.badge} title={`${subagents.length} subagents`}>
              <GitFork size={10} aria-hidden />
              {subagents.length}
            </span>
          )}
        </span>
        <span className="sr-only">{meta.label}</span>
      </button>
    </li>
  );
});
