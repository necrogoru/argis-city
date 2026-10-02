import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "../domain/types";
import type { AgentSource } from "../services/agentSource";

export interface SnapshotState {
  snapshot: Snapshot | null;
  error: string | null;
  /** Force the backend to collect now. */
  refresh: () => Promise<void>;
}

interface FeedState {
  snapshot: Snapshot | null;
  error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Never let a late initial fetch overwrite a newer pushed snapshot. */
function accept(prev: FeedState, next: Snapshot): FeedState {
  if (prev.snapshot && prev.snapshot.generatedAt > next.generatedAt) return prev;
  return { snapshot: next, error: null };
}

/** Initial fetch + live subscription to an AgentSource. */
export function useSnapshotFeed(source: AgentSource): SnapshotState {
  const [state, setState] = useState<FeedState>({ snapshot: null, error: null });

  useEffect(() => {
    let alive = true;
    const onSnapshot = (next: Snapshot) => alive && setState((prev) => accept(prev, next));
    const unsubscribe = source.subscribe(onSnapshot);
    source.getSnapshot().then(onSnapshot, (error: unknown) => {
      if (alive) setState((prev) => ({ ...prev, error: errorMessage(error) }));
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [source]);

  const refresh = useCallback(async () => {
    try {
      const next = await source.refresh();
      setState((prev) => accept(prev, next));
    } catch (error) {
      setState((prev) => ({ ...prev, error: errorMessage(error) }));
    }
  }, [source]);

  return { ...state, refresh };
}
