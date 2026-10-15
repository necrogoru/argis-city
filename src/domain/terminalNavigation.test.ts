import { describe, expect, it } from "vitest";
import { getTerminalTabForKey, shouldStartTerminalForKey } from "./terminalNavigation";

describe("getTerminalTabForKey", () => {
  it.each([
    ["agent", "term"],
    ["term", "agent"],
  ] as const)("toggles from %s on Ctrl+Tab", (activeTab, expectedTab) => {
    expect(getTerminalTabForKey(activeTab, { key: "Tab", ctrlKey: true })).toBe(expectedTab);
  });

  it.each([
    { key: "Tab", ctrlKey: false },
    { key: "Tab", ctrlKey: true, altKey: true },
    { key: "Tab", ctrlKey: true, metaKey: true },
    { key: "Enter", ctrlKey: true },
  ])("does not toggle for unrelated or modified shortcuts: %o", (event) => {
    expect(getTerminalTabForKey("agent", event)).toBeNull();
  });

  it.each([
    ["agent", "ArrowRight", "term"],
    ["term", "ArrowLeft", "agent"],
    ["agent", "ArrowLeft", "agent"],
    ["term", "ArrowRight", "term"],
    ["term", "Home", "agent"],
    ["agent", "End", "term"],
  ] as const)("keeps accessible tab navigation: %s + %s selects %s", (activeTab, key, expectedTab) => {
    expect(getTerminalTabForKey(activeTab, { key, ctrlKey: false })).toBe(expectedTab);
  });

  it("ignores keys outside the terminal shortcuts", () => {
    expect(getTerminalTabForKey("agent", { key: "Escape", ctrlKey: false })).toBeNull();
  });
});

describe("shouldStartTerminalForKey", () => {
  const event = (key: string, modifiers: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    defaultPrevented: boolean;
  }> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...modifiers,
  });

  it("starts the selected pane for an unmodified S when it can start", () => {
    expect(shouldStartTerminalForKey(event("s"), true)).toBe(true);
  });

  it("does not start for other keys or when the selected pane is already running", () => {
    expect(shouldStartTerminalForKey(event("b"), true)).toBe(false);
    expect(shouldStartTerminalForKey(event("s"), false)).toBe(false);
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["repeated", { repeat: true }],
    ["composing", { isComposing: true }],
    ["already handled", { defaultPrevented: true }],
  ] as const)("ignores %s keystrokes", (_label, modifiers) => {
    expect(shouldStartTerminalForKey(event("s", modifiers), true)).toBe(false);
  });
});
