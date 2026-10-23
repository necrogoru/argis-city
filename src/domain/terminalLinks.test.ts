import { describe, expect, it } from "vitest";
import { shouldOpenTerminalLink } from "./terminalLinks";

function click(modifiers: { metaKey?: boolean; shiftKey?: boolean }): Pick<MouseEvent, "metaKey" | "shiftKey"> {
  return { metaKey: false, shiftKey: false, ...modifiers };
}

describe("shouldOpenTerminalLink", () => {
  it("opens only on Cmd+Shift+click", () => {
    expect(shouldOpenTerminalLink(click({ metaKey: true, shiftKey: true }))).toBe(true);
  });

  it("leaves plain, Cmd-only, and Shift-only clicks to the agent", () => {
    expect(shouldOpenTerminalLink(click({}))).toBe(false);
    expect(shouldOpenTerminalLink(click({ metaKey: true }))).toBe(false);
    expect(shouldOpenTerminalLink(click({ shiftKey: true }))).toBe(false);
  });
});
