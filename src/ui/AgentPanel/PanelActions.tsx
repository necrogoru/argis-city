import { useEffect, useState } from "react";
import { Check, Copy, FolderOpen } from "lucide-react";
import { useAgentSource } from "../../state/AgentSourceContext";
import styles from "./PanelActions.module.css";

/** Primary "Open folder" (reveals cwd via the backend) + copy-path ghost button. */
export function PanelActions({ cwd }: { cwd: string }) {
  const source = useAgentSource();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1_500);
    return () => clearTimeout(id);
  }, [copied]);

  const open = () => {
    source.openPath(cwd).catch((error: unknown) => console.error("[argis] open_path failed", error));
  };
  const copy = () => {
    navigator.clipboard?.writeText(cwd).then(() => setCopied(true), () => setCopied(false));
  };

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={open}>
        <FolderOpen size={16} aria-hidden />
        Open folder
      </button>
      <button
        type="button"
        className={styles.ghost}
        aria-label={copied ? "Path copied" : "Copy directory path"}
        title="Copy directory path"
        onClick={copy}
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
    </div>
  );
}
