import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProviderId } from "../domain/types";
import {
  EMPTY_SELECTION,
  escapeSelection,
  reconcileSelection,
  toggleProvider,
  withProvider,
  withSession,
  type Selection,
} from "../domain/selection";
import { useSnapshot } from "./SnapshotContext";
import { useEscapeKey } from "./useEscapeKey";

export interface SelectionApi {
  selection: Selection;
  selectSession: (sessionId: string | null) => void;
  clearSession: () => void;
  focusProvider: (provider: ProviderId | null) => void;
  toggleProvider: (provider: ProviderId) => void;
}

const SelectionContext = createContext<SelectionApi | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useSnapshot();
  const [raw, setRaw] = useState<Selection>(EMPTY_SELECTION);
  const selection = snapshot ? reconcileSelection(raw, snapshot) : raw;

  // Persist the reconciliation so a vanished session never silently comes back.
  useEffect(() => {
    if (selection !== raw) setRaw(selection);
  }, [selection, raw]);

  useEscapeKey(() => setRaw(escapeSelection));

  const actions = useMemo(
    () => ({
      selectSession: (id: string | null) => setRaw((s) => withSession(s, id)),
      clearSession: () => setRaw((s) => withSession(s, null)),
      focusProvider: (provider: ProviderId | null) => setRaw((s) => withProvider(s, provider)),
      toggleProvider: (provider: ProviderId) => setRaw((s) => toggleProvider(s, provider)),
    }),
    [],
  );
  const api = useMemo<SelectionApi>(() => ({ selection, ...actions }), [selection, actions]);
  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionApi {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("useSelection must be used inside <SelectionProvider>");
  return value;
}
