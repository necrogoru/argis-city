/**
 * Pure city layout math (world units, ground plane = XZ). The isometric camera
 * looks from +X/+Y/+Z, so "front" is +X+Z and screen-left is −X+Z.
 */
import type { TowerSlot } from "../domain/providers";

export type Vec2 = readonly [number, number];

export const MIN_TOWER_SPACING = 7;
export const FIRST_RING_CAPACITY = 8;
const RING_CAPACITY_STEP = 4;
const FIRST_RING_BASE = 2.5;
const FIRST_RING_GROWTH = 0.1;
const RING_GAP = 1.7;
/** Angle pointing at the camera; a lone house sits right in front of its tower. */
export const FRONT_ANGLE = Math.PI / 4;
const ISO_Y = 2 / Math.sqrt(6); // screen-space scale of world height / depth

const SLOT_SIGNS: Readonly<Record<TowerSlot, Vec2>> = {
  back: [-1, -1],
  left: [-1, 1],
  front: [1, 1],
  right: [1, -1],
};

export function towerPosition(slot: TowerSlot, spacing = MIN_TOWER_SPACING): Vec2 {
  const [sx, sz] = SLOT_SIGNS[slot];
  return [sx * spacing, sz * spacing];
}

/** Mild growth with live sessions, capped so busy districts stay readable. */
export function towerHeight(sessionCount: number): number {
  return 3.2 + 0.42 * Math.min(Math.max(sessionCount, 0), 10);
}

export function ringCapacity(ring: number): number {
  return FIRST_RING_CAPACITY + ring * RING_CAPACITY_STEP;
}

export function ringRadius(ring: number, housesInRing: number): number {
  if (ring === 0) return FIRST_RING_BASE + FIRST_RING_GROWTH * housesInRing;
  return FIRST_RING_BASE + FIRST_RING_GROWTH * FIRST_RING_CAPACITY + ring * RING_GAP;
}

export interface HouseSlot {
  x: number;
  z: number;
  ring: number;
}

/** House offsets around their tower: ring 0 holds 8, then 12, 16, … */
export function housePositions(count: number): HouseSlot[] {
  const slots: HouseSlot[] = [];
  for (let ring = 0, left = Math.max(0, count); left > 0; ring += 1) {
    const capacity = ringCapacity(ring);
    const n = Math.min(capacity, left);
    const radius = ringRadius(ring, n);
    // Even counts shift half a step so no house hides directly behind the
    // tower; odd rings stagger a further quarter step against the ring inside.
    const offset = (n % 2 === 0 ? Math.PI / n : 0) + (ring % 2 === 1 ? Math.PI / (2 * n) : 0);
    for (let i = 0; i < n; i += 1) {
      const angle = FRONT_ANGLE + offset + (i / n) * Math.PI * 2;
      slots.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, ring });
    }
    left -= n;
  }
  return slots;
}

/**
 * Extra screen-space lift (px) for a house label. Mirror-image houses (same
 * screen height) always differ in index parity, so alternating lifts keeps
 * their labels from colliding; outer rings sit a little higher again.
 */
export function labelLift(index: number, ring: number): number {
  return (index % 2) * 20 + (ring > 0 ? 8 : 0);
}

/** Radius of the ground a district occupies, including the outer house lots. */
export function districtRadius(count: number): number {
  if (count <= 0) return 1.8;
  let ring = 0;
  let left = count;
  while (left > ringCapacity(ring)) left -= ringCapacity(ring++);
  return ringRadius(ring, ring === 0 ? count : left) + 0.9;
}

/** Districts never overlap: spacing widens once a district outgrows it. */
export function citySpacing(maxRadius: number): number {
  return Math.max(MIN_TOWER_SPACING, maxRadius + 1.2);
}

/** Screen-space size (world units) of something framed by the iso camera. */
export interface Frame {
  width: number;
  height: number;
  /** World-space Y the camera should target to centre the frame. */
  targetY: number;
}

function frameFromBounds(halfWidth: number, top: number, bottom: number): Frame {
  return { width: halfWidth * 2, height: top - bottom, targetY: (top + bottom) / 2 / ISO_Y };
}

export function cityFrame(spacing: number, maxRadius: number, maxHeight: number): Frame {
  const halfWidth = Math.SQRT2 * spacing + maxRadius + 0.6;
  const top = ISO_Y * (spacing + maxHeight) + 2.4; // + tower label
  const bottom = -(ISO_Y * spacing + 0.58 * maxRadius + 0.4);
  return frameFromBounds(halfWidth, top, bottom);
}

export function districtFrame(radius: number, height: number): Frame {
  const top = ISO_Y * height + 2.4;
  const bottom = -(0.58 * radius + 0.4);
  return frameFromBounds(radius + 0.6, top, bottom);
}

export const MIN_ZOOM = 6;
export const MAX_ZOOM = 140;

export interface Size {
  width: number;
  height: number;
}

/** Orthographic zoom (px per world unit) that fits `frame` inside the free viewport. */
export function fitZoom(viewport: Size, frame: Frame, insets: Size): number {
  const freeW = Math.max(120, viewport.width - insets.width);
  const freeH = Math.max(120, viewport.height - insets.height);
  const zoom = Math.min(freeW / frame.width, freeH / frame.height);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
