import { describe, expect, it } from "vitest";
import { resolveHouseNavigationKeyAction, type HouseNavigationKeyEvent } from "./houseNavigationKeys";

function target(tagName = "BODY", blockedSelectors: string[] = [], isContentEditable = false) {
  const ownTag = tagName.toLowerCase();
  return {
    tagName,
    isContentEditable,
    closest: (selector: string) =>
      selector.split(",").some((part) => part.trim() === ownTag) ||
      blockedSelectors.some((blocked) => selector.includes(blocked))
        ? {}
        : null,
  };
}

function event(key: string, overrides: Partial<HouseNavigationKeyEvent> = {}): HouseNavigationKeyEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe("resolveHouseNavigationKeyAction", () => {
  it("maps unmodified Vim and arrow keys to movement and Enter to commit", () => {
    const body = target();
    expect(resolveHouseNavigationKeyAction(event("h"), body, false)).toEqual({ type: "move", direction: "previous" });
    expect(resolveHouseNavigationKeyAction(event("ArrowLeft"), body, false)).toEqual({
      type: "move",
      direction: "previous",
    });
    expect(resolveHouseNavigationKeyAction(event("l"), body, false)).toEqual({ type: "move", direction: "next" });
    expect(resolveHouseNavigationKeyAction(event("ArrowRight"), body, false)).toEqual({
      type: "move",
      direction: "next",
    });
    expect(resolveHouseNavigationKeyAction(event("Enter"), body, false)).toEqual({ type: "commit" });
  });

  it("ignores modified, repeated, composing, and already-handled events", () => {
    const body = target();
    const ineligible = [
      event("l", { metaKey: true }),
      event("l", { ctrlKey: true }),
      event("l", { altKey: true }),
      event("l", { shiftKey: true }),
      event("l", { repeat: true }),
      event("l", { isComposing: true }),
      event("l", { defaultPrevented: true }),
      event("Enter", { repeat: true }),
    ];
    for (const keyEvent of ineligible) {
      expect(resolveHouseNavigationKeyAction(keyEvent, body, false)).toBeNull();
    }
  });

  it("does not intercept editable fields, dialogs, or terminal input", () => {
    expect(resolveHouseNavigationKeyAction(event("ArrowRight"), target("INPUT"), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("ArrowRight"), target("TEXTAREA"), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("ArrowRight"), target("SELECT"), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("ArrowRight"), target("DIV", [], true), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("Enter"), target(), true)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("l"), target("DIV", [".xterm-helper-textarea"]), false)).toBeNull();
  });

  it("does not intercept the terminal rail or native interactive controls", () => {
    expect(resolveHouseNavigationKeyAction(event("ArrowLeft"), target("DIV", [".rail"]), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("Enter"), target("BUTTON"), false)).toBeNull();
    expect(resolveHouseNavigationKeyAction(event("l"), target("SPAN", ["button"]), false)).toBeNull();
  });

  it("leaves Escape to the existing selection escape handler", () => {
    expect(resolveHouseNavigationKeyAction(event("Escape"), target(), false)).toBeNull();
  });
});
