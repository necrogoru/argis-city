import { describe, expect, it } from "vitest";
import { isViewShortcutBlocked, resolveAppViewChord } from "../domain/appViewShortcuts";

const key = (
  value: string,
  mods: Partial<
    Record<
      "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented",
      boolean
    >
  > = {},
) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
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

describe("resolveAppViewChord", () => {
  it("resolves g then t to Tasks within 500 ms", () => {
    const first = resolveAppViewChord(key("g"), target("button"), false, null, 100);

    expect(first).toEqual({ view: null, pendingGAtMs: 100 });
    expect(resolveAppViewChord(key("t"), target("button"), false, first.pendingGAtMs, 600)).toEqual({
      view: "tasks",
      pendingGAtMs: null,
    });
  });

  it("resolves g then d to Dashboard within 500 ms", () => {
    const first = resolveAppViewChord(key("g"), target("button"), false, null, 100);

    expect(first).toEqual({ view: null, pendingGAtMs: 100 });
    expect(resolveAppViewChord(key("d"), target("button"), false, first.pendingGAtMs, 600)).toEqual({
      view: "city",
      pendingGAtMs: null,
    });
  });

  it("keeps the 500 ms boundary inclusive", () => {
    expect(resolveAppViewChord(key("d"), target("button"), false, 100, 600)).toEqual({
      view: "city",
      pendingGAtMs: null,
    });
  });

  it("expires an old g and starts a fresh sequence", () => {
    expect(resolveAppViewChord(key("d"), target("button"), false, 100, 601)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("g"), target("button"), false, 100, 601)).toEqual({
      view: null,
      pendingGAtMs: 601,
    });
  });

  it("clears a pending g when another key interrupts the sequence", () => {
    expect(resolveAppViewChord(key("x"), target("button"), false, 100, 150)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it("does not resolve a second g as a view chord", () => {
    const first = resolveAppViewChord(key("g"), target("button"), false, null, 100);

    expect(resolveAppViewChord(key("g"), target("button"), false, first.pendingGAtMs, 200)).toEqual({
      view: null,
      pendingGAtMs: 200,
    });
  });

  it("does not map numeric shortcuts to primary-view switching", () => {
    expect(resolveAppViewChord(key("1", { metaKey: true }), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("2", { metaKey: true }), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("1", { ctrlKey: true }), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("2", { ctrlKey: true }), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("does not start a chord with %s", (_label, modifiers) => {
    expect(resolveAppViewChord(key("g", modifiers), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("does not complete a chord with %s", (_label, modifiers) => {
    expect(resolveAppViewChord(key("t", modifiers), target("button"), false, 100, 150)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it.each(["input", "textarea", "select"])("does not take a sequence from %s", (tagName) => {
    expect(resolveAppViewChord(key("g"), target(tagName), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("d"), target(tagName), false, 100, 150)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it("does not take a sequence from contenteditable or terminal input", () => {
    expect(
      resolveAppViewChord(key("g"), target("div", { isContentEditable: true }), false, null, 100),
    ).toEqual({ view: null, pendingGAtMs: null });
    expect(
      resolveAppViewChord(key("t"), target("div", { matches: ".xterm-helper-textarea" }), false, 100, 150),
    ).toEqual({ view: null, pendingGAtMs: null });
  });

  it("clears a pending sequence while a dialog is open", () => {
    expect(resolveAppViewChord(key("g"), target("button"), true, 100, 150)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
    expect(resolveAppViewChord(key("d"), target("button"), true, 100, 150)).toEqual({
      view: null,
      pendingGAtMs: null,
    });
  });

  it("allows chords from non-editable page controls", () => {
    expect(resolveAppViewChord(key("g"), target("button"), false, null, 100)).toEqual({
      view: null,
      pendingGAtMs: 100,
    });
    expect(resolveAppViewChord(key("t"), target("button"), false, 100, 150)).toEqual({
      view: "tasks",
      pendingGAtMs: null,
    });
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
