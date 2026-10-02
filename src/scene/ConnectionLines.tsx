import { memo, useMemo, useRef, type ComponentRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Color } from "three";
import type { ProviderId } from "../domain/types";
import { PROVIDERS } from "../domain/providers";
import { buildConnections, connectionKey, type LineHouse, type Point } from "./connectionModel";

interface ConnectionLinesProps {
  houses: readonly LineHouse[];
  provider: ProviderId;
}

/** Dashes that stream from running houses towards their tower. */
function FlowLine({ points, hex }: { points: Point[]; hex: string }) {
  const line = useRef<ComponentRef<typeof Line>>(null);
  const color = useMemo(() => new Color(hex).multiplyScalar(1.8), [hex]);
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * 0.9;
  });
  return (
    <Line
      ref={line}
      points={points}
      segments
      dashed
      dashSize={0.22}
      gapSize={0.28}
      color={color}
      lineWidth={1.6}
      toneMapped={false}
    />
  );
}

/** Status-tinted lines from every house lot to its tower (2 draw calls max). */
export const ConnectionLines = memo(function ConnectionLines({ houses, provider }: ConnectionLinesProps) {
  const key = connectionKey(houses);
  // Keyed on positions + statuses, not on the per-snapshot array identity.
  const model = useMemo(() => buildConnections(houses, provider), [key, provider]);

  if (model.base.length === 0) return null;
  return (
    <>
      <Line points={model.base} vertexColors={model.baseColors} segments lineWidth={1.2} toneMapped={false} />
      {model.flow.length > 0 && <FlowLine points={model.flow} hex={PROVIDERS[provider].hex} />}
    </>
  );
});
