import { ChevronLeft, X } from "lucide-react";
import type { AgentSession } from "../../domain/types";
import type { ProviderMeta } from "../../domain/providers";
import { formatHouseNumber } from "../../domain/format";
import { StatusPill } from "../common/StatusPill";
import { Swatch } from "../common/Swatch";
import styles from "./PanelHeader.module.css";

interface PanelHeaderProps {
  session: AgentSession;
  meta: ProviderMeta;
  houseNumber: number;
  onBack: () => void;
  onClose: () => void;
}

/** Crumb, title, back + close buttons, then status pill + `model · PID`. */
export function PanelHeader({ session, meta, houseNumber, onBack, onClose }: PanelHeaderProps) {
  const details = [session.model, session.pid != null ? `PID ${session.pid}` : null].filter(Boolean).join(" · ");

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <p className={styles.crumb}>
            <Swatch color={meta.color} />
            {meta.label} · House {formatHouseNumber(houseNumber)}
          </p>
          <h2 className={styles.title} title={session.title}>
            {session.title}
          </h2>
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.iconButton} aria-label="Back to agent list" onClick={onBack}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" className={styles.iconButton} aria-label="Close details" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.status}>
        <StatusPill status={session.status} />
        {details && <span className={styles.details}>{details}</span>}
      </div>
    </header>
  );
}
