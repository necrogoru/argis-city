import { memo, useMemo, useRef, type RefObject } from "react";
import type { Mesh, Object3D } from "three";
import type { ProviderMeta } from "../domain/providers";
import { clampPercent } from "../domain/progress";
import type { DistrictModel } from "./cityModel";
import { ConnectionLines } from "./ConnectionLines";
import { House } from "./house/House";
import { Tower } from "./Tower";

interface DistrictProps {
  district: DistrictModel;
  highlighted: boolean;
  selectedId: string | null;
  onSelectHouse: (id: string) => void;
  onFocus: (meta: ProviderMeta) => void;
}

/** One provider: its tower, the houses around it and the lines joining them. */
export const District = memo(function District(props: DistrictProps) {
  const { district, highlighted, selectedId, onSelectHouse, onFocus } = props;
  const towerBody = useRef<Mesh>(null);
  const occluders = useMemo(() => [towerBody as RefObject<Object3D>], []);
  const lines = useMemo(
    () => district.houses.map((h) => ({ x: h.x, z: h.z, status: h.session.status })),
    [district.houses],
  );

  return (
    <group position={[district.x, 0, district.z]}>
      <Tower
        meta={district.meta}
        height={district.height}
        count={district.houses.length}
        state={district.state}
        highlighted={highlighted}
        onFocus={onFocus}
        bodyRef={towerBody}
      />
      <ConnectionLines houses={lines} provider={district.provider} />
      {district.houses.map(({ session, number, ring, x, z }) => (
        <House
          key={session.id}
          id={session.id}
          provider={session.provider}
          status={session.status}
          title={session.title}
          percent={clampPercent(session.progress.percent)}
          index={number - 1}
          ring={ring}
          x={x}
          z={z}
          selected={session.id === selectedId}
          onSelect={onSelectHouse}
          occluders={occluders}
        />
      ))}
    </group>
  );
});
