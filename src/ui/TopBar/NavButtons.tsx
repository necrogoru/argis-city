import { Activity, Boxes, Rows3 } from "lucide-react";
import styles from "./NavButtons.module.css";

const UPCOMING = [
  { label: "Sessions list (coming soon)", Icon: Rows3 },
  { label: "Activity timeline (coming soon)", Icon: Activity },
];

/** View switcher: City is the only view today; others are placeholders. */
export function NavButtons() {
  return (
    <nav className={`glass ${styles.group}`} aria-label="Views">
      <button type="button" className={styles.active} aria-current="page">
        <span className={styles.tile}>
          <Boxes size={18} strokeWidth={2} aria-hidden />
        </span>
        City
      </button>
      {UPCOMING.map(({ label, Icon }) => (
        <button key={label} type="button" className={styles.ghost} aria-label={label} title={label} aria-disabled>
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </nav>
  );
}
