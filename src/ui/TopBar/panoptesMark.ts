/**
 * The Panoptes mark — an eye drawn with ~a hundred dots — in the 1024-unit
 * space of the app icon (`src-tauri/icons/app-icon.svg`), so the animated
 * logo in the top bar and the Dock icon are the same drawing.
 */

export interface MarkDot {
  x: number;
  y: number;
  r: number;
  fill: string;
  opacity: number;
  /** Distance from the pupil; the ripple reaches farther dots later. */
  dist: number;
  /** One of the few white dots that light up teal: an agent waking up. */
  agent: boolean;
}

export const MARK_CENTER = 512;
export const PUPIL_RADIUS = 46;

const ALMOND_W = 680;
const ALMOND_H = 400;
const PITCH = 44; // hex grid spacing
const PUPIL_CLEARANCE = 70; // grid dots start outside this radius
const IRIS_RADIUS = 180;
const INNER_IRIS_RADIUS = 120;

const TEAL = "#32F3E2";
const BLUE = "#67A2FD";
const VIOLET = "#B98CFF";
const SCLERA = "#E4ECEE";

// The almond is the overlap of two circles (the lids) whose centres sit
// LID_OFFSET above and below the eye's centre.
const LID_OFFSET = (ALMOND_W ** 2 - ALMOND_H ** 2) / (4 * ALMOND_H);
const LID_RADIUS = LID_OFFSET + ALMOND_H / 2;

function insideAlmond(x: number, y: number, margin: number): boolean {
  return Math.hypot(x, y - LID_OFFSET) <= LID_RADIUS - margin && Math.hypot(x, y + LID_OFFSET) <= LID_RADIUS - margin;
}

/** 0 on a lid, 1 deep inside the almond. */
function depth(x: number, y: number): number {
  const fromLid = Math.min(LID_RADIUS - Math.hypot(x, y - LID_OFFSET), LID_RADIUS - Math.hypot(x, y + LID_OFFSET));
  return Math.max(0, Math.min(1, fromLid / (ALMOND_H / 2)));
}

function mix(a: string, b: string, t: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [from, to] = [channels(a), channels(b)];
  return `#${from.map((v, i) => Math.round(v + (to[i] - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

function buildDots(): MarkDot[] {
  const dots: MarkDot[] = [];
  const rowHeight = (PITCH * Math.sqrt(3)) / 2;
  let scleraIndex = 0;
  for (let row = -6; row <= 6; row++) {
    for (let col = -10; col <= 10; col++) {
      const x = (col + (Math.abs(row) % 2 ? 0.5 : 0)) * PITCH;
      const y = row * rowHeight;
      const dist = Math.hypot(x, y);
      if (dist < PUPIL_CLEARANCE) continue;

      const iris = dist < IRIS_RADIUS;
      const r = iris ? 15.5 : 5 + 7 * depth(x, y);
      if (!insideAlmond(x, y, r + 4)) continue;

      const fill = !iris
        ? SCLERA
        : dist < INNER_IRIS_RADIUS
          ? TEAL
          : mix(BLUE, VIOLET, Math.min(1, (dist - INNER_IRIS_RADIUS) / (IRIS_RADIUS - INNER_IRIS_RADIUS)));
      dots.push({
        x: round(MARK_CENTER + x),
        y: round(MARK_CENTER + y),
        r: round(r),
        fill,
        opacity: iris ? 1 : round(0.28 + 0.6 * depth(x, y), 2),
        dist: round(dist),
        // Every seventh white dot is an agent.
        agent: !iris && scleraIndex++ % 7 === 3,
      });
    }
  }
  return dots;
}

export const MARK_DOTS: readonly MarkDot[] = buildDots();
