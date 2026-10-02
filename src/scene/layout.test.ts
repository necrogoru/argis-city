import { describe, expect, it } from "vitest";
import {
  cityFrame,
  citySpacing,
  districtRadius,
  fitZoom,
  FRONT_ANGLE,
  labelLift,
  housePositions,
  MAX_ZOOM,
  MIN_TOWER_SPACING,
  MIN_ZOOM,
  ringRadius,
  towerHeight,
  towerPosition,
} from "./layout";

const dist = (x: number, z: number) => Math.hypot(x, z);

describe("towerPosition", () => {
  it("places the four slots on a diamond around the origin", () => {
    expect(towerPosition("back")).toEqual([-MIN_TOWER_SPACING, -MIN_TOWER_SPACING]);
    expect(towerPosition("front")).toEqual([MIN_TOWER_SPACING, MIN_TOWER_SPACING]);
    expect(towerPosition("left", 10)).toEqual([-10, 10]);
    expect(towerPosition("right", 10)).toEqual([10, -10]);
  });
});

describe("towerHeight", () => {
  it("grows mildly with sessions and is capped", () => {
    expect(towerHeight(0)).toBeCloseTo(3.2);
    expect(towerHeight(3)).toBeGreaterThan(towerHeight(1));
    expect(towerHeight(50)).toBe(towerHeight(10));
    expect(towerHeight(-1)).toBe(towerHeight(0));
  });
});

describe("housePositions", () => {
  it("returns one slot per house", () => {
    expect(housePositions(0)).toEqual([]);
    expect(housePositions(13)).toHaveLength(13);
  });

  it("puts the first house in front of the tower (towards the camera)", () => {
    const [first] = housePositions(1);
    expect(first.x).toBeGreaterThan(0);
    expect(first.z).toBeCloseTo(first.x);
  });

  it("never hides a house directly behind its tower", () => {
    const back = FRONT_ANGLE + Math.PI;
    for (let count = 1; count <= 24; count += 1) {
      for (const h of housePositions(count)) {
        const angle = Math.atan2(h.z, h.x);
        const gap = Math.abs(Math.atan2(Math.sin(angle - back), Math.cos(angle - back)));
        expect(gap).toBeGreaterThan(0.1);
      }
    }
  });

  it("fills a first ring of 8 and starts a second ring after", () => {
    expect(housePositions(8).every((h) => h.ring === 0)).toBe(true);
    const nine = housePositions(9);
    expect(nine[8].ring).toBe(1);
    expect(dist(nine[8].x, nine[8].z)).toBeGreaterThan(dist(nine[0].x, nine[0].z));
  });

  it("grows the first ring radius with house count", () => {
    expect(ringRadius(0, 8)).toBeGreaterThan(ringRadius(0, 2));
    const r2 = dist(housePositions(2)[0].x, housePositions(2)[0].z);
    const r8 = dist(housePositions(8)[0].x, housePositions(8)[0].z);
    expect(r8).toBeGreaterThan(r2);
  });

  it("keeps neighbouring houses at least a lot apart", () => {
    const slots = housePositions(20);
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        expect(dist(slots[i].x - slots[j].x, slots[i].z - slots[j].z)).toBeGreaterThan(1.3);
      }
    }
  });
});

describe("labelLift", () => {
  it("alternates by index so mirror-image houses never share a label height", () => {
    for (const count of [2, 3, 5, 8]) {
      const slots = housePositions(count);
      for (let i = 0; i < count; i += 1) {
        for (let j = i + 1; j < count; j += 1) {
          const sameHeight = Math.abs(slots[i].x + slots[i].z - (slots[j].x + slots[j].z)) < 1e-6;
          if (sameHeight) expect(labelLift(i, slots[i].ring)).not.toBe(labelLift(j, slots[j].ring));
        }
      }
    }
  });

  it("lifts outer rings", () => {
    expect(labelLift(0, 1)).toBeGreaterThan(labelLift(0, 0));
  });
});

describe("districtRadius / citySpacing", () => {
  it("covers the outermost house lot", () => {
    for (const count of [1, 8, 9, 20, 21]) {
      const outer = Math.max(...housePositions(count).map((h) => dist(h.x, h.z)));
      expect(districtRadius(count)).toBeGreaterThan(outer);
    }
  });

  it("widens spacing only when districts would overlap", () => {
    expect(citySpacing(districtRadius(8))).toBe(MIN_TOWER_SPACING);
    const big = districtRadius(40);
    expect(citySpacing(big)).toBeGreaterThan(big);
  });
});

describe("fitZoom", () => {
  const frame = cityFrame(MIN_TOWER_SPACING, 4, 6);

  it("fits the frame inside the free viewport", () => {
    const zoom = fitZoom({ width: 1440, height: 900 }, frame, { width: 760, height: 280 });
    expect(frame.width * zoom).toBeLessThanOrEqual(1440 - 760 + 1e-6);
    expect(frame.height * zoom).toBeLessThanOrEqual(900 - 280 + 1e-6);
  });

  it("clamps to the allowed zoom range", () => {
    expect(fitZoom({ width: 100, height: 100 }, { width: 500, height: 500, targetY: 0 }, { width: 0, height: 0 }))
      .toBe(MIN_ZOOM);
    expect(fitZoom({ width: 5000, height: 5000 }, { width: 1, height: 1, targetY: 0 }, { width: 0, height: 0 }))
      .toBe(MAX_ZOOM);
  });

  it("grows the city frame with spacing and height", () => {
    const bigger = cityFrame(MIN_TOWER_SPACING + 3, 4, 8);
    expect(bigger.width).toBeGreaterThan(frame.width);
    expect(bigger.height).toBeGreaterThan(frame.height);
  });
});
