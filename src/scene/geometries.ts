/**
 * Shared, module-level geometries: created once, reused by every mesh, so
 * snapshot updates never allocate GPU buffers.
 */
import {
  BoxGeometry,
  ConeGeometry,
  OctahedronGeometry,
  RingGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const TOWER = { plinth: 2.6, width: 1.5, crown: 1.15, crownHeight: 0.3 } as const;
export const HOUSE = { lot: 1.3, width: 0.9, height: 0.6, roofHeight: 0.5 } as const;
/** Height of the roof apex — anchor for labels and beacons. */
export const HOUSE_TOP = HOUSE.height + HOUSE.roofHeight;

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Face 0 = +Z, 1 = +X (both camera-facing), 2 = −Z, 3 = −X. */
type FacePick = (face: number, slot: number) => boolean;

function onFaces(half: number, slots: number[], make: (x: number, out: number) => BufferGeometry, pick: FacePick) {
  const parts: BufferGeometry[] = [];
  for (let face = 0; face < 4; face += 1) {
    slots.forEach((x, slot) => {
      if (pick(face, slot)) parts.push(make(x, half).rotateY((face * Math.PI) / 2));
    });
  }
  return merge(parts);
}

export const unitBox = new BoxGeometry(1, 1, 1);

/** 4-sided pyramid roof aligned with the house box. */
export const roofGeometry = new ConeGeometry(HOUSE.width * 0.8, HOUSE.roofHeight, 4, 1)
  .rotateY(Math.PI / 4)
  .translate(0, HOUSE.height + HOUSE.roofHeight / 2, 0);

const houseWindow = (x: number, out: number) => boxAt(0.16, 0.18, 0.02, x, HOUSE.height * 0.55, out);
const isKeyWindow: FacePick = (face, slot) => face < 2 && slot === 0;

/** The two camera-facing windows that stay lit even when a house is idle. */
export const houseKeyWindowGeometry = onFaces(HOUSE.width / 2 + 0.01, [-0.2, 0.2], houseWindow, isKeyWindow);
/** The other six windows. */
export const houseRestWindowGeometry = onFaces(
  HOUSE.width / 2 + 0.01,
  [-0.2, 0.2],
  houseWindow,
  (face, slot) => !isKeyWindow(face, slot),
);

/** Three vertical light strips per tower face, in unit height (scaled by tower height). */
export const towerStripGeometry = onFaces(
  TOWER.width / 2 + 0.01,
  [-0.42, 0, 0.42],
  (x, out) => boxAt(0.1, 0.8, 0.02, x, 0.5, out),
  () => true,
);

/** 2×2 rooftop panels sitting on the tower crown. */
export const roofPanelGeometry = merge(
  [-0.26, 0.26].flatMap((x) => [-0.26, 0.26].map((z) => boxAt(0.42, 0.04, 0.42, x, 0, z))),
);

/** Ground ring under the selected house. */
export const selectionRingGeometry = new RingGeometry(0.82, 0.92, 48).rotateX(-Math.PI / 2);

/** Expanding ground pulse (scaled up while it fades). */
export const pulseRingGeometry = new RingGeometry(0.7, 0.78, 48).rotateX(-Math.PI / 2);

/** "Needs you" beacon: a diamond (stretched in Y by the mesh). */
export const beaconGeometry = new OctahedronGeometry(0.17, 0);

/** Done halo: three arcs, so its slow rotation is visible. */
export const haloGeometry = merge(
  [0, 1, 2].map((i) =>
    new RingGeometry(0.3, 0.36, 16, 1, (i * 2 * Math.PI) / 3, (2 * Math.PI) / 3 - 0.5).rotateX(-Math.PI / 2),
  ),
);
