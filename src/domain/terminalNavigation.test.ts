import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERMINAL_TAB,
  getTerminalTabForKey,
  shouldCloseTerminalModalForKey,
  shouldStartTerminalForKey,
} from "./terminalNavigation";

describe("DEFAULT_TERMINAL_TAB", () => {
  it("opens task terminals on the shell tab", () => {
    expect(DEFAULT_TERMINAL_TAB).toBe("term");
  });
});

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

describe("shouldCloseTerminalModalForKey", () => {
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

  it("closes on Ctrl+Esc, including while the terminal has focus", () => {
    expect(shouldCloseTerminalModalForKey(event("Escape", { ctrlKey: true }), true)).toBe(true);
    expect(shouldCloseTerminalModalForKey(event("Escape", { ctrlKey: true }), false)).toBe(true);
  });

  it("does not consume Escape when terminal input is focused", () => {
    expect(shouldCloseTerminalModalForKey(event("Escape"), true)).toBe(false);
  });

  it("keeps Escape as a close shortcut outside terminal input", () => {
    expect(shouldCloseTerminalModalForKey(event("Escape"), false)).toBe(true);
  });

  it("does not close on the legacy Ctrl+Shift+W chord", () => {
    expect(shouldCloseTerminalModalForKey(event("w", { ctrlKey: true, shiftKey: true }), true)).toBe(false);
  });

  it.each([
    ["unmodified W", event("w")],
    ["Ctrl+W", event("w", { ctrlKey: true })],
    ["Shift+Escape", event("Escape", { shiftKey: true })],
    ["Alt+Escape", event("Escape", { altKey: true })],
    ["Meta+Escape", event("Escape", { metaKey: true })],
    ["Ctrl+Shift+Esc", event("Escape", { ctrlKey: true, shiftKey: true })],
    ["Ctrl+Alt+Esc", event("Escape", { ctrlKey: true, altKey: true })],
    ["repeated Ctrl+Esc", event("Escape", { ctrlKey: true, repeat: true })],
    ["composing Ctrl+Esc", event("Escape", { ctrlKey: true, isComposing: true })],
    ["handled Ctrl+Esc", event("Escape", { ctrlKey: true, defaultPrevented: true })],
  ] as const)("ignores %s", (_label, keyEvent) => {
    expect(shouldCloseTerminalModalForKey(keyEvent, true)).toBe(false);
  });
});
