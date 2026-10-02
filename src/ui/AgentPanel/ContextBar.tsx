import type { TokenUsage } from "../../domain/types";
import { formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";
import styles from "./ContextBar.module.css";

type Level = "ok" | "high" | "full";

function levelOf(share: number): Level {
  if (share >= 0.95) return "full";
  return share >= 0.8 ? "high" : "ok";
}

/** 6px context-window bar with used / window readout. */
export function ContextBar({ tokens }: { tokens: TokenUsage }) {
  const share = contextShare(tokens);
  const readout =
    share != null && tokens.contextUsed != null && tokens.contextWindow != null
      ? `${formatTokens(tokens.contextUsed)} / ${formatCompact(tokens.contextWindow)}`
      : "Unknown";

  return (
    <div className={styles.block}>
      <div className={styles.head}>
        <span className="caps">Context window</span>
        <span className={styles.readout}>{readout}</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label="Context window usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share == null ? undefined : Math.round(share * 100)}
      >
        <span
          className={styles.fill}
          data-level={share == null ? "ok" : levelOf(share)}
          style={{ width: `${(share ?? 0) * 100}%` }}
        />
      </div>
    </div>
  );
}
