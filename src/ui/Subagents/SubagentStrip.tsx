import { GitFork } from "lucide-react";
import { subagentCounts } from "../../domain/session";
import { useSelectedSession } from "../../state/useSelectedSession";
import { SubagentCard } from "./SubagentCard";
import styles from "./SubagentStrip.module.css";

/** Bottom strip listing the selected session's subagents (only when it has any). */
export function SubagentStrip() {
  const selected = useSelectedSession();
  if (!selected || selected.session.subagents.length === 0) return null;

  const { session } = selected;
  const { total, running } = subagentCounts(session);

  return (
    <section className={`glass ${styles.strip}`} aria-label="Subagents">
      <header className={styles.head}>
        <h2 className={styles.title}>
          <GitFork size={16} aria-hidden />
          Subagents
        </h2>
        <p className={styles.parent} title={session.title}>
          Spawned by <span>{session.title}</span>
        </p>
        <p className={styles.counts}>
          {total} total · {running} running
        </p>
      </header>
      <ul className={styles.cards}>
        {session.subagents.map((agent) => (
          <li key={agent.id} className={styles.item}>
            <SubagentCard agent={agent} />
          </li>
        ))}
      </ul>
    </section>
  );
}
