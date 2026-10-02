import { useAgentSource } from "../../state/AgentSourceContext";
import { useSnapshot } from "../../state/SnapshotContext";
import { useNow } from "../../state/useNow";
import { POLL_INTERVAL_MS } from "../../services/agentSource";
import styles from "./LiveIndicator.module.css";

/** A snapshot older than this many poll intervals counts as stale. */
const STALE_AFTER = 3;

type Tone = "live" | "stale" | "error";

/** "Live · scanning 2s" pill; turns amber when updates stop arriving. */
export function LiveIndicator() {
  const source = useAgentSource();
  const { snapshot, error } = useSnapshot();
  const now = useNow(POLL_INTERVAL_MS);
  const seconds = POLL_INTERVAL_MS / 1000;

  const stale = snapshot != null && now - snapshot.generatedAt > POLL_INTERVAL_MS * STALE_AFTER;
  const tone: Tone = error && !snapshot ? "error" : stale ? "stale" : "live";
  const text =
    tone === "error"
      ? "Backend unavailable"
      : tone === "stale"
        ? "Reconnecting…"
        : `${source.kind === "demo" ? "Demo data" : "Live"} · scanning ${seconds}s`;

  return (
    <div className={styles.pill} data-tone={tone} role="status">
      <span className={styles.dot} aria-hidden />
      {text}
    </div>
  );
}
