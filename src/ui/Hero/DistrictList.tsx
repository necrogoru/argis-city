import { PROVIDER_ORDER, PROVIDERS } from "../../domain/providers";
import type { ProviderId, Snapshot } from "../../domain/types";
import { useSelection } from "../../state/SelectionContext";
import { useSnapshot } from "../../state/SnapshotContext";
import { Swatch } from "../common/Swatch";
import styles from "./DistrictList.module.css";

function countLabel(snapshot: Snapshot | null, provider: ProviderId): string {
  if (!snapshot) return "—";
  const summary = snapshot.providers.find((p) => p.provider === provider);
  if (summary && !summary.available) return "Not installed";
  const count = snapshot.sessions.filter((s) => s.provider === provider).length;
  return `${count} ${count === 1 ? "house" : "houses"}`;
}

/** One row per provider; selecting a row focuses the camera on its tower. */
export function DistrictList() {
  const { snapshot } = useSnapshot();
  const { selection, toggleProvider } = useSelection();

  return (
    <div className={styles.block}>
      <h2 className="caps">Districts</h2>
      <ul className={styles.list}>
        {PROVIDER_ORDER.map((id) => {
          const meta = PROVIDERS[id];
          const selected = selection.provider === id;
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.row}
                aria-pressed={selected}
                onClick={() => toggleProvider(id)}
              >
                <Swatch color={meta.color} />
                <span className={styles.name}>{meta.label}</span>
                <span className={styles.count}>{countLabel(snapshot, id)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
