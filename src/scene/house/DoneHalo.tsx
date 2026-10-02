import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { haloGeometry, HOUSE_TOP } from "../geometries";
import { haloMaterial } from "../materials";

/** "Done": a flat, segmented blue halo slowly turning above the roof. */
export function DoneHalo() {
  const halo = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (halo.current) halo.current.rotation.y += delta * 0.6;
  });

  return <mesh ref={halo} geometry={haloGeometry} material={haloMaterial} position-y={HOUSE_TOP + 0.24} />;
}
