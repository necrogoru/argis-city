import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  escapeSelection,
  reconcileSelection,
  toggleProvider,
  withProvider,
  withSession,
} from "./selection";
import { session, snapshot } from "./testFixtures";

const snap = snapshot([session({ id: "claude:a" }), session({ id: "codex:b", provider: "codex" })]);

describe("reconcileSelection", () => {
  it("keeps a selection whose session is still live (same reference)", () => {
    const sel = { sessionId: "claude:a", provider: "claude" as const };
    expect(reconcileSelection(sel, snap)).toBe(sel);
  });

  it("clears the session when it disappears but keeps the focused district", () => {
    const sel = { sessionId: "claude:gone", provider: "claude" as const };
    expect(reconcileSelection(sel, snap)).toEqual({ sessionId: null, provider: "claude" });
  });

  it("returns the empty selection untouched", () => {
    expect(reconcileSelection(EMPTY_SELECTION, snapshot([]))).toBe(EMPTY_SELECTION);
  });
});

describe("selection transitions", () => {
  it("withSession / withProvider are referentially stable when unchanged", () => {
    const sel = { sessionId: "claude:a", provider: null };
    expect(withSession(sel, "claude:a")).toBe(sel);
    expect(withProvider(sel, null)).toBe(sel);
    expect(withSession(sel, null)).toEqual({ sessionId: null, provider: null });
  });

  it("toggles the focused district", () => {
    const focused = toggleProvider(EMPTY_SELECTION, "pi");
    expect(focused.provider).toBe("pi");
    expect(toggleProvider(focused, "pi").provider).toBeNull();
    expect(toggleProvider(focused, "codex").provider).toBe("codex");
  });

  it("escape clears the house first, then the district", () => {
    const sel = { sessionId: "claude:a", provider: "claude" as const };
    const once = escapeSelection(sel);
    expect(once).toEqual({ sessionId: null, provider: "claude" });
    expect(escapeSelection(once)).toEqual(EMPTY_SELECTION);
    expect(escapeSelection(EMPTY_SELECTION)).toBe(EMPTY_SELECTION);
  });
});
