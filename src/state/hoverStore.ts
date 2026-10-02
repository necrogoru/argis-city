/**
 * Tiny external store for "which session is hovered" — shared by the 3D houses
 * and the agent list. Consumers subscribe to a boolean for *their* id, so a
 * hover change re-renders two components, not the whole city.
 */
export interface HoverStore {
  get(): string | null;
  set(id: string | null): void;
  /** Clear only if `id` is still the hovered one (avoids leave/enter races). */
  clear(id: string): void;
  subscribe(listener: () => void): () => void;
}

export function createHoverStore(): HoverStore {
  let hovered: string | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    get: () => hovered,
    set(id) {
      if (hovered === id) return;
      hovered = id;
      emit();
    },
    clear(id) {
      if (hovered !== id) return;
      hovered = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
