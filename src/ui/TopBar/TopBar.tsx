import { RefreshCw } from "lucide-react";
import { useSnapshot } from "../../state/SnapshotContext";
import { IconButton } from "../common/IconButton";
import { Brand } from "./Brand";
import { KpiStrip } from "./KpiStrip";
import { LiveIndicator } from "./LiveIndicator";
import { SearchTrigger } from "./SearchTrigger";
import styles from "./TopBar.module.css";

/** Brand · KPIs · search (⌘K) · live status + refresh. */
export function TopBar() {
  const { refresh } = useSnapshot();
  return (
    <header className={styles.bar}>
      <Brand />
      <KpiStrip />
      <div className={styles.right}>
        <SearchTrigger />
        <LiveIndicator />
        <IconButton label="Refresh now" size={48} onClick={() => void refresh()}>
          <RefreshCw size={18} aria-hidden />
        </IconButton>
      </div>
    </header>
  );
}
