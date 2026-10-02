import { useEffect, useRef } from "react";
import { useRetained } from "../state/useRetained";
import { useSelectedSession } from "../state/useSelectedSession";
import { useSelection } from "../state/SelectionContext";
import { AgentList } from "./AgentList/AgentList";
import { AgentPanel } from "./AgentPanel/AgentPanel";
import styles from "./RightColumn.module.css";

/**
 * Right-hand column: the Agents list by default, the detail panel while a
 * session is selected. Both stay mounted and crossfade (~200 ms); the hidden
 * one is `inert`, and keyboard focus follows the visible one.
 */
export function RightColumn() {
  const selected = useSelectedSession();
  const shown = useRetained(selected); // keep panel content while it fades out
  const { clearSession } = useSelection();
  const open = selected != null;
  const listSlot = useRef<HTMLDivElement>(null);
  const panelSlot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [from, to] = open ? [listSlot, panelSlot] : [panelSlot, listSlot];
    const active = document.activeElement;
    if (active && from.current?.contains(active)) to.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  return (
    <div className={styles.column}>
      <div ref={listSlot} className={styles.slot} data-kind="list" data-active={!open} inert={open}>
        <AgentList />
      </div>
      <div ref={panelSlot} className={styles.slot} data-kind="panel" data-active={open} inert={!open}>
        {shown && <AgentPanel selected={shown} onBack={clearSession} onClose={clearSession} />}
      </div>
    </div>
  );
}
