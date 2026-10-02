import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, type BufferAttribute, type Points } from "three";
import { HOUSE_TOP } from "../geometries";

const COUNT = 7;
const RISE = 0.8;

/** Fixed pseudo-random per-particle parameters, so embers look irregular. */
const EMBERS = Array.from({ length: COUNT }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 91.7 + n * 47.3) * 43758.5453;
    return x - Math.floor(x);
  };
  return { offset: r(1), speed: 0.28 + r(2) * 0.3, angle: r(3) * Math.PI * 2, drift: 0.08 + r(4) * 0.2 };
});

let sparkTexture: CanvasTexture | null = null;
/** Soft round dot, created once on first use. */
function getSparkTexture(): CanvasTexture {
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

/** "Running": a few light sparks drifting up from the roof apex, fading as they rise. */
export function RoofSparks({ hex, phase }: { hex: string; phase: number }) {
  const points = useRef<Points>(null);
  const base = useMemo(() => new Color(hex).multiplyScalar(2.2), [hex]);
  const buffers = useMemo(
    () => ({ position: new Float32Array(COUNT * 3), color: new Float32Array(COUNT * 3) }),
    [],
  );

  useFrame(({ clock }) => {
    const geometry = points.current?.geometry;
    if (!geometry) return;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const color = geometry.getAttribute("color") as BufferAttribute;
    const t = clock.elapsedTime;
    EMBERS.forEach((ember, i) => {
      const life = (t * ember.speed + ember.offset + phase) % 1;
      const angle = ember.angle + t * 0.5;
      const spread = 0.04 + life * ember.drift;
      position.setXYZ(i, Math.cos(angle) * spread, HOUSE_TOP - 0.05 + life * RISE, Math.sin(angle) * spread);
      const fade = Math.sin(life * Math.PI); // fade in, then out
      color.setXYZ(i, base.r * fade, base.g * fade, base.b * fade);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.color, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getSparkTexture()}
        size={6}
        sizeAttenuation={false}
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
