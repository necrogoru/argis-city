import type { AgentSession } from "../../domain/types";
import { formatClock, formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";
import { Elapsed } from "../common/Elapsed";
import { StatTile } from "./StatTile";
import styles from "./PanelStats.module.css";

function tokensCaption(session: AgentSession): string {
  const share = contextShare(session.tokens);
  const window = session.tokens.contextWindow;
  if (share != null && window != null) return `${Math.round(share * 100)}% of ${formatCompact(window)} ctx`;
  return `${formatTokens(session.tokens.output)} output`;
}

/** Tokens and Elapsed tiles side by side. */
export function PanelStats({ session }: { session: AgentSession }) {
  return (
    <div className={styles.row}>
      <StatTile label="Tokens" value={formatTokens(session.tokens.total)} caption={tokensCaption(session)} />
      <StatTile
        label="Elapsed"
        value={<Elapsed item={session} />}
        caption={`since ${formatClock(session.startedAt)}`}
      />
    </div>
  );
}
