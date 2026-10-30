import { describe, expect, it } from "vitest";
import type { TerminalTab } from "./types";
import {
  AGENT_TAB,
  BASE_SHELL_TAB,
  MAX_SHELL_TABS,
  isAgentTab,
  isShellTab,
  mergeTerminalTabs,
  nextShellTab,
  shellTab,
  shellTabSlot,
  sortTerminalTabs,
  terminalTabLabel,
} from "./terminalTabs";

describe("shell tabs", () => {
  it("uses canonical wire ids: term for slot 1 and term-N for extra shells", () => {
    expect(shellTab(1)).toBe("term");
    expect(shellTab(2)).toBe("term-2");
    expect(shellTab(MAX_SHELL_TABS)).toBe(`term-${MAX_SHELL_TABS}`);
  });

  it("parses only supported, canonical shell ids", () => {
    expect(shellTabSlot("term")).toBe(1);
    expect(shellTabSlot("term-2")).toBe(2);
    expect(shellTabSlot(`term-${MAX_SHELL_TABS}`)).toBe(MAX_SHELL_TABS);
    for (const id of ["agent", "term-1", "term-0", "term-02", "term-+2", "term-", "term-7"]) {
      expect(shellTabSlot(id as TerminalTab)).toBeNull();
    }
  });

  it("labels the agent, base shell, and extra shells", () => {
    expect(terminalTabLabel("agent")).toBe("Agent");
    expect(terminalTabLabel("term")).toBe("term");
    expect(terminalTabLabel("term-2")).toBe("term 2");
  });

  it("classifies agent and shell ids", () => {
    expect(isAgentTab("agent")).toBe(true);
    expect(isAgentTab("term-2")).toBe(false);
    expect(isShellTab("term")).toBe(true);
    expect(isShellTab("agent")).toBe(false);
  });
});

describe("nextShellTab", () => {
  it("returns the lowest free slot", () => {
    expect(nextShellTab([AGENT_TAB, BASE_SHELL_TAB])).toBe("term-2");
    expect(nextShellTab([AGENT_TAB, BASE_SHELL_TAB, "term-2", "term-4"])).toBe("term-3");
  });

  it("returns null when every shell slot is taken", () => {
    const full = [AGENT_TAB];
    for (let slot = 1; slot <= MAX_SHELL_TABS; slot += 1) full.push(shellTab(slot));

    expect(nextShellTab(full)).toBeNull();
  });
});

describe("sortTerminalTabs", () => {
  it("keeps agent first and shells in slot order", () => {
    expect(sortTerminalTabs(["term-5", "agent", "term", "term-2"])).toEqual([
      AGENT_TAB,
      BASE_SHELL_TAB,
      "term-2",
      "term-5",
    ]);
  });
});

describe("mergeTerminalTabs", () => {
  it("adds backend shells without dropping local tabs and ignores agent duplicates", () => {
    expect(mergeTerminalTabs(["agent", "term"], ["agent", "term-2", "term-3", "term-2"])).toEqual([
      AGENT_TAB,
      BASE_SHELL_TAB,
      "term-2",
      "term-3",
    ]);
  });

  it("drops unsupported shell ids reported by the backend", () => {
    expect(mergeTerminalTabs(["agent", "term"], ["term-1", "term-99"])).toEqual([AGENT_TAB, BASE_SHELL_TAB]);
  });
});
