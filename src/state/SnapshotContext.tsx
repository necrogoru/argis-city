import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAgentSource } from "./AgentSourceContext";
import { useSnapshotFeed, type SnapshotState } from "./useSnapshotFeed";

const SnapshotContext = createContext<SnapshotState | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const source = useAgentSource();
  const { snapshot, error, refresh } = useSnapshotFeed(source);
  const value = useMemo(() => ({ snapshot, error, refresh }), [snapshot, error, refresh]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

/** Latest snapshot (null until the first one arrives), last error, and refresh. */
export function useSnapshot(): SnapshotState {
  const value = useContext(SnapshotContext);
  if (!value) throw new Error("useSnapshot must be used inside <SnapshotProvider>");
  return value;
}
