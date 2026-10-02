/** Shared matte materials (low-poly dark city) and unlit glow materials. */
import { Color, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { PALETTE } from "../domain/palette";

const matte = (color: string, roughness = 0.88, metalness = 0.12) =>
  new MeshStandardMaterial({ color, roughness, metalness });

export const plinthMaterial = matte("#15181A", 0.95, 0.05);
export const towerBodyMaterial = matte("#1D2124");
export const towerCrownMaterial = matte("#24282B");
export const lotMaterial = matte("#121517", 1, 0);

/** Unlit HDR colour (> 1) so bloom picks it up; `toneMapped: false` keeps it hot. */
export function glowMaterial(hex: string, boost: number, transparent = false): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(hex).multiplyScalar(boost),
    toneMapped: false,
    transparent,
    depthWrite: !transparent,
  });
}

export const selectionRingMaterial = glowMaterial(PALETTE.teal, 1, true);
export const beaconMaterial = glowMaterial(PALETTE.amber, 2.6);
export const haloMaterial = glowMaterial(PALETTE.blue, 1.7, true);

/** Near-black base for emissive parts so only the emissive term shows. */
export const GLOW_BASE_COLOR = "#050606";
