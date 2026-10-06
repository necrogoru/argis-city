import { computed, type ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Color, type MeshStandardMaterial } from "three";
import { emissiveAt, type HouseVisual } from "../domain/houseVisuals";

type MaterialRef = Readonly<ShallowRef<MeshStandardMaterial | null>>;

export interface HouseGlowRefs {
  keyWindows: MaterialRef;
  restWindows: MaterialRef;
  roof: MaterialRef;
  body: MaterialRef;
}

const HOVER_BOOST = 1.35;
const DARK_WINDOW = 0.02;

/**
 * Drives a house's materials every frame from its HouseVisual. Colours ease
 * over ~0.5 s and intensity over ~70 ms, so status changes never snap while
 * blinks and flickers stay crisp.
 */
export function useHouseGlow(
  refs: HouseGlowRefs,
  visual: () => HouseVisual,
  phase: () => number,
  hovered: () => boolean,
): void {
  const target = computed(() => ({ glow: new Color(visual().hex), body: new Color(visual().bodyHex) }));
  let level: number | null = null;
  /** 0 = only the key windows lit (idle), 1 = all windows lit; eased. */
  let litMix: number | null = null;

  useLoop().onBeforeRender(({ delta, elapsed }) => {
    const keyWindows = refs.keyWindows.value;
    const restWindows = refs.restWindows.value;
    const roof = refs.roof.value;
    const body = refs.body.value;
    if (!keyWindows || !restWindows || !roof || !body) return;
    const kColor = 1 - Math.exp(-delta * 4);
    const kLevel = 1 - Math.exp(-delta * 14);
    const current = visual();

    const goal = emissiveAt(current, elapsed, phase()) * (hovered() ? HOVER_BOOST : 1);
    level = level == null ? goal : level + (goal - level) * kLevel;
    const litGoal = current.litWindows === "few" ? 0 : 1;
    litMix = litMix == null ? litGoal : litMix + (litGoal - litMix) * kColor;

    const { glow, body: bodyColor } = target.value;
    keyWindows.emissive.lerp(glow, kColor);
    restWindows.emissive.lerp(glow, kColor);
    roof.emissive.lerp(glow, kColor);
    keyWindows.emissiveIntensity = level;
    restWindows.emissiveIntensity = DARK_WINDOW + (level - DARK_WINDOW) * litMix;
    roof.emissiveIntensity = 0.03 + level * 0.28;
    body.color.lerp(bodyColor, kColor);
  });
}
