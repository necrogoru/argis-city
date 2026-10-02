import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createHoverStore, type HoverStore } from "./hoverStore";

const HoverContext = createContext<HoverStore | null>(null);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createHoverStore);
  return <HoverContext.Provider value={store}>{children}</HoverContext.Provider>;
}

/** Imperative access (set / clear) — stable, never re-renders the caller. */
export function useHoverStore(): HoverStore {
  const store = useContext(HoverContext);
  if (!store) throw new Error("useHoverStore must be used inside <HoverProvider>");
  return store;
}

/** True while `id` is hovered anywhere (its house in 3D or its list row). */
export function useIsHovered(id: string): boolean {
  const store = useHoverStore();
  const isHovered = useCallback(() => store.get() === id, [store, id]);
  return useSyncExternalStore(store.subscribe, isHovered, isHovered);
}
