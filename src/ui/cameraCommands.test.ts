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
  it("maps ⇧⌘= / ⇧⌘+ to zoom in, ⇧⌘- to zoom out and ⇧⌘0 to fit", () => {
    expect(cameraCommandFor(key("=", { metaKey: true, shiftKey: true }), true)?.label).toBe("Zoom in");
    expect(cameraCommandFor(key("+", { metaKey: true, shiftKey: true }), true)?.label).toBe("Zoom in");
    expect(cameraCommandFor(key("-", { metaKey: true, shiftKey: true }), true)?.label).toBe("Zoom out");
    expect(cameraCommandFor(key("_", { metaKey: true, shiftKey: true }), true)?.label).toBe("Zoom out");
    expect(cameraCommandFor(key("0", { metaKey: true, shiftKey: true }), true)?.label).toBe("Fit city to view");
    expect(cameraCommandFor(key(")", { metaKey: true, shiftKey: true }), true)?.label).toBe("Fit city to view");
    expect(cameraCommandFor(key("-", { ctrlKey: true, shiftKey: true }), false)?.label).toBe("Zoom out");
  });

  it("leaves the unshifted Chrome zoom chords to app zoom", () => {
    expect(cameraCommandFor(key("=", { metaKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("-", { metaKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("0", { metaKey: true }), true)).toBeUndefined();
  });

  it("ignores bare keys, the other platform's modifier, Alt chords and unbound keys", () => {
    expect(cameraCommandFor(key("=", { shiftKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("=", { ctrlKey: true, shiftKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("-", { metaKey: true, shiftKey: true, altKey: true }), true)).toBeUndefined();
    expect(cameraCommandFor(key("k", { metaKey: true, shiftKey: true }), true)).toBeUndefined();
  });
});

describe("shortcutAria", () => {
  it("lists the shifted camera binding, spelling punctuation as key names", () => {
    const zoomIn = CAMERA_COMMANDS.find((c) => c.label === "Zoom in")!;
    const zoomOut = CAMERA_COMMANDS.find((c) => c.label === "Zoom out")!;
    const fit = CAMERA_COMMANDS.find((c) => c.label === "Fit city to view")!;
    expect(shortcutAria(zoomIn.keys, "Meta")).toBe("Meta+Shift+Plus");
    expect(shortcutAria(zoomOut.keys, "Meta")).toBe("Meta+Shift+Minus");
    expect(shortcutAria(fit.keys, "Meta")).toBe("Meta+Shift+0");
    expect(shortcutAria(undefined, "Meta")).toBeUndefined();
  });
});
