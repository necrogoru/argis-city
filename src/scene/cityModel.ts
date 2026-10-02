import type { AgentSession, ProviderId, ProviderSummary, Snapshot } from "../domain/types";
import { PROVIDER_ORDER, PROVIDERS, type ProviderMeta } from "../domain/providers";
import { sessionsOf } from "../domain/session";
import {
  cityFrame,
  citySpacing,
  districtRadius,
  housePositions,
  towerHeight,
  towerPosition,
  type Frame,
} from "./layout";

export interface HouseModel {
  session: AgentSession;
  /** 1-based number within the district. */
  number: number;
  /** Offset from the tower centre. */
  x: number;
  z: number;
  /** 0 = inner ring of 8. */
  ring: number;
}

export type DistrictState = "live" | "empty" | "unavailable";

export interface DistrictModel {
  provider: ProviderId;
  meta: ProviderMeta;
  state: DistrictState;
  x: number;
  z: number;
  height: number;
  radius: number;
  houses: HouseModel[];
}

export interface CityModel {
  districts: DistrictModel[];
  frame: Frame;
}

function districtState(summary: ProviderSummary | undefined, count: number): DistrictState {
  if (count > 0) return "live";
  return summary && !summary.available ? "unavailable" : "empty";
}

/** Derive the whole city (all four districts, always) from a snapshot. */
export function buildCity(snapshot: Snapshot | null): CityModel {
  const grouped = PROVIDER_ORDER.map((provider) => ({
    provider,
    sessions: snapshot ? sessionsOf(snapshot, provider) : [],
    summary: snapshot?.providers.find((p) => p.provider === provider),
  }));
  const radii = grouped.map((g) => districtRadius(g.sessions.length));
  const maxRadius = Math.max(...radii);
  const spacing = citySpacing(maxRadius);

  const districts = grouped.map(({ provider, sessions, summary }, i): DistrictModel => {
    const meta = PROVIDERS[provider];
    const [x, z] = towerPosition(meta.slot, spacing);
    const slots = housePositions(sessions.length);
    return {
      provider,
      meta,
      state: districtState(summary, sessions.length),
      x,
      z,
      height: towerHeight(sessions.length),
      radius: radii[i],
      houses: sessions.map((session, n) => ({
        session,
        number: n + 1,
        x: slots[n].x,
        z: slots[n].z,
        ring: slots[n].ring,
      })),
    };
  });

  const maxHeight = Math.max(...districts.map((d) => d.height));
  return { districts, frame: cityFrame(spacing, maxRadius, maxHeight) };
}
