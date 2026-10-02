import type { CSSProperties } from "react";
import { Clock, Coins, Gauge } from "lucide-react";
import type { SubAgent } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { formatTokens } from "../../domain/format";
import { displayProgress, progressFraction } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import { Elapsed } from "../common/Elapsed";
import { StatusPill } from "../common/StatusPill";
import styles from "./SubagentCard.module.css";

/** Title + status pill, 4px progress bar in status colour, % · tokens · elapsed. */
export function SubagentCard({ agent }: { agent: SubAgent }) {
  const progress = displayProgress(agent.progress);
  const tint = { "--tint": cssVar(statusMeta(agent.status).color) } as CSSProperties;
  const tooltip = agent.kind ? `${agent.title} (${agent.kind})` : agent.title;

  return (
    <article className={styles.card} style={tint} data-status={agent.status}>
      <div className={styles.top}>
        <h3 className={styles.title} title={tooltip}>
          {agent.title}
        </h3>
        <StatusPill status={agent.status} />
      </div>
      <div className={styles.bar} aria-hidden>
        <span style={{ width: `${progressFraction(agent.progress) * 100}%` }} />
      </div>
      <div className={styles.meta}>
        <span title={`Progress: ${progress.caption}`}>
          <Gauge size={12} aria-hidden />
          {progress.label}
        </span>
        <span title="Tokens">
          <Coins size={12} aria-hidden />
          {formatTokens(agent.tokens.total)}
        </span>
        <span title="Elapsed">
          <Clock size={12} aria-hidden />
          <Elapsed item={agent} />
        </span>
      </div>
    </article>
  );
}
