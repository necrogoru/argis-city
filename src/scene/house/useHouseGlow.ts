import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type MeshStandardMaterial } from "three";
import { emissiveAt, type HouseVisual } from "../../domain/houseVisuals";

export interface HouseGlowRefs {
  keyWindows: RefObject<MeshStandardMaterial | null>;
  restWindows: RefObject<MeshStandardMaterial | null>;
  roof: RefObject<MeshStandardMaterial | null>;
  body: RefObject<MeshStandardMaterial | null>;
}

const HOVER_BOOST = 1.35;
const DARK_WINDOW = 0.02;

/**
 * Drives a house's materials every frame from its HouseVisual. Colours ease
 * over ~0.5 s and intensity over ~70 ms, so status changes never snap while
 * blinks and flickers stay crisp.
 */
export function useHouseGlow(refs: HouseGlowRefs, visual: HouseVisual, phase: number, hovered: boolean) {
  const target = useMemo(
    () => ({ glow: new Color(visual.hex), body: new Color(visual.bodyHex) }),
    [visual.hex, visual.bodyHex],
  );
  const level = useRef<number | null>(null);
  /** 0 = only the key windows lit (idle), 1 = all windows lit; eased. */
  const litMix = useRef<number | null>(null);

  useFrame(({ clock }, delta) => {
    const { keyWindows, restWindows, roof, body } = refs;
    if (!keyWindows.current || !restWindows.current || !roof.current || !body.current) return;
    const kColor = 1 - Math.exp(-delta * 4);
    const kLevel = 1 - Math.exp(-delta * 14);

    const goal = emissiveAt(visual, clock.elapsedTime, phase) * (hovered ? HOVER_BOOST : 1);
    const current = level.current == null ? goal : level.current + (goal - level.current) * kLevel;
    level.current = current;
    const litGoal = visual.litWindows === "few" ? 0 : 1;
    const mix = litMix.current == null ? litGoal : litMix.current + (litGoal - litMix.current) * kColor;
    litMix.current = mix;

    for (const material of [keyWindows.current, restWindows.current, roof.current]) {
      material.emissive.lerp(target.glow, kColor);
    }
    keyWindows.current.emissiveIntensity = current;
    restWindows.current.emissiveIntensity = DARK_WINDOW + (current - DARK_WINDOW) * mix;
    roof.current.emissiveIntensity = 0.03 + current * 0.28;
    body.current.color.lerp(target.body, kColor);
  });
}
