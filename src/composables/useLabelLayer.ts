import { inject, type InjectionKey, type ShallowRef } from "vue";

type LabelLayer = Readonly<ShallowRef<HTMLDivElement | null>>;

/**
 * DOM layer (above the canvas, below the UI overlay) hosting every in-scene
 * label. A stable portal target matters: labels rendered into a node that
 * appears later re-mount and can race the previous render, so CityCanvas owns
 * one element for the whole session and labels wait until it exists.
 */
export const labelLayerKey: InjectionKey<LabelLayer> = Symbol("labelLayer");

export function useLabelLayer(): LabelLayer {
  const layer = inject(labelLayerKey);
  if (!layer) throw new Error("useLabelLayer must be used inside <CityCanvas>");
  return layer;
}
