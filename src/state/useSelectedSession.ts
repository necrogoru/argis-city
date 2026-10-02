import { useMemo } from "react";
import { findSelected, type SelectedSession } from "../domain/session";
import { useSelection } from "./SelectionContext";
import { useSnapshot } from "./SnapshotContext";

/** The selected house's session, its house number and provider metadata. */
export function useSelectedSession(): SelectedSession | null {
  const { snapshot } = useSnapshot();
  const { selection } = useSelection();
  return useMemo(() => findSelected(snapshot, selection.sessionId), [snapshot, selection.sessionId]);
}
