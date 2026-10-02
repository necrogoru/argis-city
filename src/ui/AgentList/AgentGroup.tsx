import type { AgentGroup as AgentGroupModel } from "../../domain/agentList";
import { Swatch } from "../common/Swatch";
import { AgentRow } from "./AgentRow";
import styles from "./AgentGroup.module.css";

interface AgentGroupProps {
  group: AgentGroupModel;
  onSelect: (id: string) => void;
}

/** Caps header (swatch · provider · count) followed by its session rows. */
export function AgentGroup({ group, onSelect }: AgentGroupProps) {
  const headingId = `agents-${group.provider}`;
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h3 id={headingId} className={`caps ${styles.heading}`}>
        <Swatch color={group.meta.color} size={8} />
        <span className={styles.name}>{group.meta.label}</span>
        <span className={styles.count}>{group.sessions.length}</span>
      </h3>
      <ul className={styles.rows}>
        {group.sessions.map((session) => (
          <AgentRow key={session.id} session={session} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}
