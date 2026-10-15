import { describe, expect, it } from "vitest";
import { getTerminalTabForKey } from "./terminalNavigation";

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
