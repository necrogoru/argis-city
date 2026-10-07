import { describe, expect, it } from "vitest";
import { CAMERA_COMMANDS, cameraCommandFor, shortcutAria } from "./cameraCommands";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("cameraCommandFor", () => {
  it("maps ⌘= / ⌘+ to zoom in, ⌘- to zoom out and ⌘0 to fit, browser-style", () => {
    expect(cameraCommandFor(key("=", { metaKey: true }), true)?.label).toBe("Zoom in");
    expect(cameraCommandFor(key("+", { metaKey: true, shiftKey: true }), true)?.label).toBe("Zoom in");
    expect(cameraCommandFor(key("-", { metaKey: true }), true)?.label).toBe("Zoom out");
    expect(cameraCommandFor(key("0", { metaKey: true }), true)?.label).toBe("Fit city to view");
    expect(cameraCommandFor(key("-", { ctrlKey: true }), false)?.label).toBe("Zoom out");
  });

  it("ignores bare keys, the other platform's modifier, Alt chords and unbound keys", () => {
    expect(cameraCommandFor(key("="), true)).toBeUndefined();
    expect(cameraCommandFor(key("=", { ctrlKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("-", { metaKey: true, altKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("k", { metaKey: true }), true)).toBeUndefined();
  });
});

describe("shortcutAria", () => {
  it("lists each binding as an aria-keyshortcuts alternative, spelling + as Plus", () => {
    const zoomIn = CAMERA_COMMANDS.find((c) => c.label === "Zoom in")!;
    expect(shortcutAria(zoomIn.keys, "Meta")).toBe("Meta+= Meta+Plus");
    expect(shortcutAria(undefined, "Meta")).toBeUndefined();
  });
});
