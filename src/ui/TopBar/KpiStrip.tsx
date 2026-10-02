import { useMemo } from "react";
import { Bot, Coins, GitFork, Hand, type LucideIcon } from "lucide-react";
import { computeKpis } from "../../domain/kpis";
import { formatTokens } from "../../domain/format";
import { useSnapshot } from "../../state/SnapshotContext";
import styles from "./KpiStrip.module.css";

interface Kpi {
  label: string;
  value: string;
  Icon: LucideIcon;
  alert?: boolean;
}

/** Active agents · Subagents · Tokens · Awaiting you. */
export function KpiStrip() {
  const { snapshot } = useSnapshot();
  const kpis = useMemo(() => computeKpis(snapshot), [snapshot]);
  const items: Kpi[] = [
    { label: "Active agents", value: String(kpis.activeAgents), Icon: Bot },
    { label: "Subagents", value: String(kpis.subagents), Icon: GitFork },
    { label: "Tokens total", value: formatTokens(kpis.totalTokens), Icon: Coins },
    { label: "Awaiting you", value: String(kpis.awaiting), Icon: Hand, alert: true },
  ];

  return (
    <dl className={styles.strip} aria-live="off">
      {items.map(({ label, value, Icon, alert }) => (
        <div key={label} className={styles.kpi} data-alert={alert && kpis.awaiting > 0}>
          <span className={styles.icon} data-amber={alert}>
            <Icon size={16} aria-hidden />
          </span>
          <div className={styles.text}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
