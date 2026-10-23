import { describe, expect, it } from "vitest";
import { appZoomActionFor, nextAppZoom, normalizeAppZoom } from "./appZoom";

const key = (
  k: string,
  mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("appZoomActionFor", () => {
  it("maps ⌘= to zoom in, ⌘- to zoom out and ⌘0 to reset on macOS", () => {
    expect(appZoomActionFor(key("=", { metaKey: true }), true)).toBe("in");
    expect(appZoomActionFor(key("-", { metaKey: true }), true)).toBe("out");
    expect(appZoomActionFor(key("0", { metaKey: true }), true)).toBe("reset");
  });

  it("uses Ctrl off macOS and accepts a keypad plus", () => {
    expect(appZoomActionFor(key("=", { ctrlKey: true }), false)).toBe("in");
    expect(appZoomActionFor(key("+", { ctrlKey: true }), false)).toBe("in");
    expect(appZoomActionFor(key("-", { ctrlKey: true }), false)).toBe("out");
  });

  it("leaves the shift chords to the camera", () => {
    expect(appZoomActionFor(key("+", { metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(appZoomActionFor(key("_", { metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(appZoomActionFor(key(")", { metaKey: true, shiftKey: true }), true)).toBeNull();
  });

  it("ignores Alt, bare keys, the other platform's modifier and unbound keys", () => {
    expect(appZoomActionFor(key("=", { metaKey: true, altKey: true }), true)).toBeNull();
    expect(appZoomActionFor(key("="), true)).toBeNull();
    expect(appZoomActionFor(key("=", { ctrlKey: true }), true)).toBeNull();
    expect(appZoomActionFor(key("k", { metaKey: true }), true)).toBeNull();
  });
});

describe("nextAppZoom", () => {
  it("steps through the levels around 100%", () => {
    expect(nextAppZoom(1, "in")).toBe(1.1);
    expect(nextAppZoom(1.1, "in")).toBe(1.25);
    expect(nextAppZoom(1, "out")).toBe(0.9);
    expect(nextAppZoom(0.9, "out")).toBe(0.8);
  });

  it("stops at the smallest and largest levels", () => {
    expect(nextAppZoom(0.5, "out")).toBe(0.5);
    expect(nextAppZoom(2, "in")).toBe(2);
  });

  it("resets to 100%", () => {
    expect(nextAppZoom(1.75, "reset")).toBe(1);
    expect(nextAppZoom(0.5, "reset")).toBe(1);
  });

  it("steps from a level that is not an exact step", () => {
    expect(nextAppZoom(1.2, "in")).toBe(1.25);
    expect(nextAppZoom(1.2, "out")).toBe(1.1);
  });
});

describe("normalizeAppZoom", () => {
  it("keeps a stored step", () => {
    expect(normalizeAppZoom(1.25)).toBe(1.25);
    expect(normalizeAppZoom("0.9")).toBe(0.9);
  });

  it("snaps other values to the nearest step and clamps out-of-range values", () => {
    expect(normalizeAppZoom(1.22)).toBe(1.25);
    expect(normalizeAppZoom(10)).toBe(2);
    expect(normalizeAppZoom(0.1)).toBe(0.5);
  });

  it("falls back to 100% for missing or invalid values", () => {
    expect(normalizeAppZoom(null)).toBe(1);
    expect(normalizeAppZoom(undefined)).toBe(1);
    expect(normalizeAppZoom("nope")).toBe(1);
    expect(normalizeAppZoom(Number.NaN)).toBe(1);
  });
});
