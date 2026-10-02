import { createContext, useContext, type RefObject } from "react";

/**
 * DOM layer (above the canvas, below the UI overlay) that hosts every drei
 * `Html` label. A stable `portal` target matters: without it `Html` re-mounts
 * when R3F connects its events, and the old root's deferred unmount races the
 * new one on the same element — labels vanish at random.
 */
export const LabelLayerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useLabelLayer(): RefObject<HTMLElement> {
  const ref = useContext(LabelLayerContext);
  if (!ref) throw new Error("useLabelLayer must be used inside <CityCanvas>");
  return ref as RefObject<HTMLElement>;
}
