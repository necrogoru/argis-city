import { describe, expect, it } from "vitest";
import { appViewForShortcut, isViewShortcutBlocked } from "../domain/appViewShortcuts";

const key = (
  value: string,
  mods: Partial<
    Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing", boolean>
  > = {},
) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  ...mods,
});

const target = (
  tagName: string,
  options: { isContentEditable?: boolean; matches?: string } = {},
) => ({
  tagName,
  isContentEditable: options.isContentEditable ?? false,
  closest: (selector: string) => (selector === options.matches ? {} : null),
});

describe("appViewForShortcut", () => {
  it("does not map numeric modifiers to primary-view switching", () => {
    expect(appViewForShortcut(key("1", { metaKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("2", { metaKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("1", { ctrlKey: true }), false)).toBeNull();
    expect(appViewForShortcut(key("2", { ctrlKey: true }), false)).toBeNull();
  });

  it("rejects the wrong platform modifier and extra modifiers", () => {
    expect(appViewForShortcut(key("1", { ctrlKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("1", { metaKey: true }), false)).toBeNull();
    expect(appViewForShortcut(key("1", { metaKey: true, ctrlKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("1", { metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("1", { metaKey: true, altKey: true }), true)).toBeNull();
    expect(appViewForShortcut(key("3", { metaKey: true }), true)).toBeNull();
  });

  it("ignores repeated keys and IME composition", () => {
    expect(appViewForShortcut(key("1", { metaKey: true, repeat: true }), true)).toBeNull();
    expect(appViewForShortcut(key("1", { metaKey: true, isComposing: true }), true)).toBeNull();
  });
});

describe("isViewShortcutBlocked", () => {
  it.each(["input", "textarea", "select"])("blocks text-entry controls: %s", (tagName) => {
    expect(isViewShortcutBlocked(target(tagName))).toBe(true);
  });

  it("blocks contenteditable elements and terminal input", () => {
    expect(isViewShortcutBlocked(target("div", { isContentEditable: true }))).toBe(true);
    expect(isViewShortcutBlocked(target("textarea", { matches: ".xterm-helper-textarea" }))).toBe(true);
  });

  it("blocks navigation while a modal dialog is open", () => {
    expect(isViewShortcutBlocked(target("button"), true)).toBe(true);
  });

  it("allows shortcuts from non-editable page controls", () => {
    expect(isViewShortcutBlocked(target("button"))).toBe(false);
    expect(isViewShortcutBlocked(null)).toBe(false);
  });
});
