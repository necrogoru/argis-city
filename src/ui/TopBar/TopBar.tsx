import { RefreshCw } from "lucide-react";
import { useSnapshot } from "../../state/SnapshotContext";
import { IconButton } from "../common/IconButton";
import { Brand } from "./Brand";
import { KpiStrip } from "./KpiStrip";
import { LiveIndicator } from "./LiveIndicator";
import { NavButtons } from "./NavButtons";
import styles from "./TopBar.module.css";

/** Brand · nav · KPIs · live status + refresh. */
export function TopBar() {
  const { refresh } = useSnapshot();
  return (
    <header className={styles.bar}>
      <Brand />
      <NavButtons />
      <KpiStrip />
      <div className={styles.right}>
        <LiveIndicator />
        <IconButton label="Refresh now" size={48} onClick={() => void refresh()}>
          <RefreshCw size={18} aria-hidden />
        </IconButton>
      </div>
    </header>
  );
}
