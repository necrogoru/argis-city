import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { SNAPSHOT_EVENT, type Snapshot } from "../domain/types";
import type { AgentSource } from "./agentSource";

/** AgentSource backed by the Rust commands/events in docs/CONTRACT.md. */
export function createTauriAgentSource(): AgentSource {
  return {
    kind: "live",
    getSnapshot: () => invoke<Snapshot>("get_snapshot"),
    refresh: () => invoke<Snapshot>("refresh_snapshot"),
    openPath: (path) => invoke<void>("open_path", { path }),
    subscribe(callback) {
      let unlisten: UnlistenFn | null = null;
      let disposed = false;
      listen<Snapshot>(SNAPSHOT_EVENT, (event) => callback(event.payload))
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch((error: unknown) => console.error("[argis] snapshot listener failed", error));
      return () => {
        disposed = true;
        unlisten?.();
      };
    },
  };
}
