/**
 * How a house looks and moves for each status — colour AND motion, so status
 * reads at a glance. Pure: the scene only consumes these values.
 */
import type { AgentStatus, ProviderId } from "./types";
import { PROVIDERS } from "./providers";
import { statusHex } from "./status";

export type HouseAnimation = "shimmer" | "blink" | "breathe" | "steady" | "flicker";
export type HouseBeacon = "sparks" | "alert" | "halo" | null;

export interface HouseVisual {
  /** Window / roof glow colour. */
  hex: string;
  /** Window emissive intensity range the animation moves within. */
  intensity: readonly [min: number, max: number];
  animation: HouseAnimation;
  beacon: HouseBeacon;
  /** "few" = only the two camera-facing windows are lit. */
  litWindows: "all" | "few";
  /** Matte body colour (error darkens to a red tint). */
  bodyHex: string;
  /** Expanding ground ring around the lot. */
  groundPulse: boolean;
  labelOpacity: number;
  /** Connection line brightness (0–1) and whether it flows to the tower. */
  lineOpacity: number;
  lineFlow: boolean;
}

/** Bloom luminance threshold in Effects.tsx; calm states must stay below it. */
export const BLOOM_THRESHOLD = 0.55;
export const BODY_HEX = "#1C1F21";
const ERROR_BODY_HEX = "#2A1B1D";
/** Blink period for "needs you" (~1.2 s: urgent, not strobing). */
export const BLINK_PERIOD_S = 1.2;
export const BREATHE_PERIOD_S = 4.5;

const base = { litWindows: "all", bodyHex: BODY_HEX, groundPulse: false, lineFlow: false } as const;

export function houseVisual(status: AgentStatus, provider: ProviderId): HouseVisual {
  const hex = statusHex(status);
  switch (status) {
    case "running":
      return { ...base, hex: PROVIDERS[provider].hex, intensity: [1.5, 2.7], animation: "shimmer",
        beacon: "sparks", labelOpacity: 1, lineOpacity: 0.6, lineFlow: true };
    case "awaitingApproval":
      return { ...base, hex, intensity: [0.3, 3.2], animation: "blink", beacon: "alert",
        groundPulse: true, labelOpacity: 1, lineOpacity: 0.55 };
    case "idle":
      return { ...base, hex, intensity: [0.18, 0.5], animation: "breathe", beacon: null,
        litWindows: "few", labelOpacity: 0.6, lineOpacity: 0.18 };
    case "done":
      return { ...base, hex, intensity: [1, 1], animation: "steady", beacon: "halo",
        labelOpacity: 0.62, lineOpacity: 0.3 };
    case "error":
      return { ...base, hex, intensity: [0.2, 1.9], animation: "flicker", beacon: null,
        bodyHex: ERROR_BODY_HEX, labelOpacity: 0.95, lineOpacity: 0.35 };
  }
}

/** Deterministic 0–1 hash of an integer (for the faulty-light flicker). */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Normalised 0–1 animation level at time `t` (s) with a per-house `phase`. */
export function animationLevel(animation: HouseAnimation, t: number, phase = 0): number {
  switch (animation) {
    case "shimmer":
      return 0.5 + 0.3 * Math.sin(t * 3.1 + phase) + 0.2 * Math.sin(t * 7.7 + phase * 2.3);
    case "blink": {
      const wave = Math.sin((2 * Math.PI * t) / BLINK_PERIOD_S);
      return Math.min(1, Math.max(0, 0.5 + wave * 1.6)); // soft square wave
    }
    case "breathe":
      return 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / BREATHE_PERIOD_S + phase);
    case "flicker": {
      const step = Math.floor(t * 11 + phase * 7);
      return hash01(step) > 0.8 ? 0.08 * hash01(step + 1) : 0.82 + 0.18 * hash01(step + 2);
    }
    case "steady":
      return 1;
  }
}

/** Window emissive intensity for a visual at time `t`. */
export function emissiveAt(visual: HouseVisual, t: number, phase = 0): number {
  const [min, max] = visual.intensity;
  return min + (max - min) * animationLevel(visual.animation, t, phase);
}

/** Expanding ground ring at `progress` 0–1: grows while fading out. */
export function ringPulse(progress: number): { scale: number; opacity: number } {
  const p = Math.min(1, Math.max(0, progress));
  return { scale: 1 + p * 1.3, opacity: Math.pow(1 - p, 1.6) };
}

/** True when a session just finished (plays the one-shot done ripple). */
export function justFinished(previous: AgentStatus | null, next: AgentStatus): boolean {
  return previous != null && previous !== "done" && next === "done";
}

/** Stable per-house phase (0–2π) so animations don't beat in unison. */
export function housePhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 628) / 100;
}
