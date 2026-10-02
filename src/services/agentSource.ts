import type { Snapshot } from "../domain/types";

/**
 * Where snapshots come from. Components depend on this abstraction only
 * (injected via `AgentSourceProvider`), never on Tauri directly.
 */
export interface AgentSource {
  /** "live" = Tauri backend, "demo" = in-browser mock data. */
  readonly kind: "live" | "demo";
  getSnapshot(): Promise<Snapshot>;
  /** Force a collect now and return the fresh snapshot. */
  refresh(): Promise<Snapshot>;
  /** Called on every poll tick; returns an unsubscribe function. */
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  /** Reveal a directory in the OS file manager. */
  openPath(path: string): Promise<void>;
}

/** Poll interval the backend (and the mock) emit snapshots at. */
export const POLL_INTERVAL_MS = 2_000;
