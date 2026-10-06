import { describe, expect, it } from "vitest";
import { isModKey } from "./useModKey";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("isModKey", () => {
  it("matches ⌘+K on macOS and Ctrl+K elsewhere, case-insensitively", () => {
    expect(isModKey(key("k", { metaKey: true }), "k", true)).toBe(true);
    expect(isModKey(key("K", { metaKey: true }), "k", true)).toBe(true);
    expect(isModKey(key("k", { ctrlKey: true }), "k", false)).toBe(true);
  });

  it("rejects the other platform's modifier, Alt/Shift chords and other keys", () => {
    expect(isModKey(key("k", { ctrlKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("k", { metaKey: true, shiftKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("k", { metaKey: true, altKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("j", { metaKey: true }), "k", true)).toBe(false);
  });
});
