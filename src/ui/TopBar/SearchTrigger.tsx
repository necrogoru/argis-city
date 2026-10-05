import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { MOD_KEY_ARIA, MOD_KEY_LABEL, useModKey } from "../../state/useModKey";
import { CommandPalette } from "../CommandPalette/CommandPalette";
import { Kbd } from "../common/Kbd";
import styles from "./SearchTrigger.module.css";

/** Search field look-alike in the top bar; click or ⌘K opens the command palette. */
export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useModKey("k", () => setOpen((o) => !o));

  return (
    <>
      <button
        type="button"
        className={`glass ${styles.trigger}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={`${MOD_KEY_ARIA}+K`}
        onClick={() => setOpen(true)}
      >
        <Search size={16} aria-hidden />
        <span className={styles.placeholder}>Search agents & actions</span>
        <Kbd>{MOD_KEY_LABEL}K</Kbd>
      </button>
      <CommandPalette open={open} onClose={close} />
    </>
  );
}
