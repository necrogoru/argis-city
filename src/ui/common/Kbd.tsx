import type { ReactNode } from "react";
import styles from "./Kbd.module.css";

/** Small key-cap hint ("⌘K", "esc", "↵"). */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
