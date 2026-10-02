import { CircleAlert, Radar } from "lucide-react";
import type { Snapshot } from "../domain/types";
import { useSnapshot } from "../state/SnapshotContext";
import styles from "./EmptyState.module.css";

interface Message {
  title: string;
  body: string;
  tone: "info" | "error";
  retry?: boolean;
}

function messageFor(snapshot: Snapshot | null, error: string | null): Message | null {
  if (!snapshot) {
    return error
      ? { title: "Can't reach the Argis backend", body: error, tone: "error", retry: true }
      : { title: "Scanning for agents…", body: "Looking for Claude Code, Codex, OpenCode and Pi sessions.", tone: "info" };
  }
  if (snapshot.sessions.length > 0) return null;
  const installed = snapshot.providers.some((p) => p.available);
  if (snapshot.providers.length > 0 && !installed) {
    return {
      title: "No supported agent tools found",
      body: "Install Claude Code, Codex, OpenCode or Pi — their towers light up here as soon as a session starts.",
      tone: "info",
    };
  }
  return null; // "no live agents" is shown inside the Agents list
}

/** Loading, backend-error and "no agent tools installed" states. */
export function EmptyState() {
  const { snapshot, error, refresh } = useSnapshot();
  const message = messageFor(snapshot, error);
  if (!message) return null;
  const Icon = message.tone === "error" ? CircleAlert : Radar;

  return (
    <div className={`glass ${styles.card}`} data-tone={message.tone} role="status">
      <Icon size={20} className={styles.icon} aria-hidden />
      <div className={styles.text}>
        <p className={styles.title}>{message.title}</p>
        <p className={styles.body}>{message.body}</p>
      </div>
      {message.retry && (
        <button type="button" className={styles.retry} onClick={() => void refresh()}>
          Retry
        </button>
      )}
    </div>
  );
}
