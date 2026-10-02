import type { ProviderId, Snapshot } from "./types";

/** What the user is looking at: one house and/or one focused district. */
export interface Selection {
  sessionId: string | null;
  provider: ProviderId | null;
}

export const EMPTY_SELECTION: Selection = { sessionId: null, provider: null };

/**
 * Keep a selection valid against a new snapshot. Returns the *same* object when
 * nothing changes so React can bail out of re-renders.
 */
export function reconcileSelection(selection: Selection, snapshot: Snapshot): Selection {
  const { sessionId } = selection;
  if (sessionId && !snapshot.sessions.some((s) => s.id === sessionId)) {
    return { ...selection, sessionId: null };
  }
  return selection;
}

export function withSession(selection: Selection, sessionId: string | null): Selection {
  return selection.sessionId === sessionId ? selection : { ...selection, sessionId };
}

export function withProvider(selection: Selection, provider: ProviderId | null): Selection {
  return selection.provider === provider ? selection : { ...selection, provider };
}

/** District rows toggle: picking the focused district again clears focus. */
export function toggleProvider(selection: Selection, provider: ProviderId): Selection {
  return withProvider(selection, selection.provider === provider ? null : provider);
}

/** Escape peels one layer: first the house, then the district focus. */
export function escapeSelection(selection: Selection): Selection {
  if (selection.sessionId) return { ...selection, sessionId: null };
  if (selection.provider) return { ...selection, provider: null };
  return selection;
}
