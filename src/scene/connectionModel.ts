/** Pure geometry for the house → tower connection lines. */
import { Color } from "three";
import type { AgentStatus, ProviderId } from "../domain/types";
import { houseVisual } from "../domain/houseVisuals";
import { HOUSE, TOWER } from "./geometries";

export type Point = [number, number, number];
export type Rgb = [number, number, number];

export interface LineHouse {
  x: number;
  z: number;
  status: AgentStatus;
}

export interface ConnectionModel {
  /** Every house: segment pairs ordered house → tower, tinted by status. */
  base: Point[];
  baseColors: Rgb[];
  /** Running houses only: segments that get the flowing dash overlay. */
  flow: Point[];
}

const Y = 0.035;

/** Segment from the lot edge to the plinth edge (house first, so dashes flow inward). */
function segment(x: number, z: number, y: number): [Point, Point] {
  const length = Math.hypot(x, z) || 1;
  const [ux, uz] = [x / length, z / length];
  const start = length - HOUSE.lot / 2 - 0.05;
  const end = TOWER.plinth / 2 + 0.1;
  return [
    [ux * start, y, uz * start],
    [ux * end, y, uz * end],
  ];
}

export function buildConnections(houses: readonly LineHouse[], provider: ProviderId): ConnectionModel {
  const model: ConnectionModel = { base: [], baseColors: [], flow: [] };
  for (const { x, z, status } of houses) {
    const visual = houseVisual(status, provider);
    const rgb = new Color(visual.hex).multiplyScalar(visual.lineOpacity).toArray() as Rgb;
    model.base.push(...segment(x, z, Y));
    model.baseColors.push(rgb, rgb);
    if (visual.lineFlow) model.flow.push(...segment(x, z, Y + 0.01));
  }
  return model;
}

/** Stable key: rebuild geometry only when positions or statuses change. */
export function connectionKey(houses: readonly LineHouse[]): string {
  return houses.map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)},${h.status}`).join("|");
}
