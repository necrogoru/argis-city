import { useCallback, useMemo, useState } from "react";
import type { AgentStatus } from "../../domain/types";
import { groupSessions, statusCounts, toggleFilter, type StatusFilter } from "../../domain/agentList";
import { useCameraRig } from "../../scene/useCameraRig";
import { useSelection } from "../../state/SelectionContext";
import { useSnapshot } from "../../state/SnapshotContext";
import { AgentGroup } from "./AgentGroup";
import { StatusChips } from "./StatusChips";
import styles from "./AgentList.module.css";

/** Right-column list of every live session, grouped by provider, filterable by status. */
export function AgentList() {
  const { snapshot } = useSnapshot();
  const { selectSession } = useSelection();
  const rig = useCameraRig();
  const [filter, setFilter] = useState<StatusFilter>(null);
  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot]);
  const counts = useMemo(() => statusCounts(sessions), [sessions]);
  const groups = useMemo(() => groupSessions(sessions, filter), [sessions, filter]);

  const onToggle = useCallback((status: AgentStatus) => setFilter((f) => toggleFilter(f, status)), []);
  const onSelect = useCallback(
    (id: string) => {
      selectSession(id);
      rig.focusSession(id);
    },
    [selectSession, rig],
  );

  return (
    <section className={`glass ${styles.panel}`} aria-label="Agents">
      <header className={styles.header}>
        <h2 className={styles.title}>
          Agents <span className={styles.total}>{sessions.length}</span>
        </h2>
        <StatusChips counts={counts} filter={filter} onToggle={onToggle} />
      </header>
      <div className={`thin-scroll ${styles.body}`}>
        {groups.map((group) => (
          <AgentGroup key={group.provider} group={group} onSelect={onSelect} />
        ))}
        {groups.length === 0 && (
          <div className={styles.empty}>
            <p>{!snapshot ? "Scanning for agents…" : filter ? "No agents with this status." : "No live agents right now."}</p>
            {filter ? (
              <button type="button" className={styles.clear} onClick={() => setFilter(null)}>
                Clear filter
              </button>
            ) : (
              snapshot && <p className={styles.hint}>Start a Claude Code, Codex, OpenCode or Pi session.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
