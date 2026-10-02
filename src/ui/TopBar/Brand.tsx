import { Building } from "lucide-react";
import styles from "./Brand.module.css";

/** Product name exactly as in the approved design. */
const BRAND_NAME = "AgentCity";

export function Brand() {
  return (
    <div className={styles.brand}>
      <Building size={24} strokeWidth={1.9} className={styles.icon} aria-hidden />
      <span className={styles.name}>{BRAND_NAME}</span>
    </div>
  );
}
