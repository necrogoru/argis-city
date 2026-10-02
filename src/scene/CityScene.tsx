import { useCallback } from "react";
import type { ProviderMeta } from "../domain/providers";
import { useSelection } from "../state/SelectionContext";
import type { CityModel } from "./cityModel";
import { District } from "./District";
import { Ground } from "./Ground";

/** Ground + all four districts, wired to the shared selection state. */
export function CityScene({ city }: { city: CityModel }) {
  const { selection, selectSession, clearSession, focusProvider } = useSelection();
  const onFocus = useCallback((meta: ProviderMeta) => focusProvider(meta.id), [focusProvider]);
  const selectedProvider = city.districts.find((d) =>
    d.houses.some((h) => h.session.id === selection.sessionId),
  )?.provider;

  return (
    <>
      <Ground onDeselect={clearSession} />
      {city.districts.map((district) => (
        <District
          key={district.provider}
          district={district}
          highlighted={selection.provider === district.provider || selectedProvider === district.provider}
          selectedId={selection.sessionId}
          onSelectHouse={selectSession}
          onFocus={onFocus}
        />
      ))}
    </>
  );
}
