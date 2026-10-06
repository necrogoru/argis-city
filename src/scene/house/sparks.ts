import { CanvasTexture } from "three";

export const SPARK_COUNT = 7;
export const SPARK_RISE = 0.8;

/** Fixed pseudo-random per-particle parameters, so embers look irregular. */
export const EMBERS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 91.7 + n * 47.3) * 43758.5453;
    return x - Math.floor(x);
  };
  return { offset: r(1), speed: 0.28 + r(2) * 0.3, angle: r(3) * Math.PI * 2, drift: 0.08 + r(4) * 0.2 };
});

let sparkTexture: CanvasTexture | null = null;

/** Soft round dot, created once on first use and shared by every house. */
export function getSparkTexture(): CanvasTexture {
  if (sparkTexture) return sparkTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const gradient = ctx?.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient?.addColorStop(0, "rgba(255,255,255,1)");
  gradient?.addColorStop(1, "rgba(255,255,255,0)");
  if (ctx && gradient) {
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  sparkTexture = new CanvasTexture(canvas);
  return sparkTexture;
}
