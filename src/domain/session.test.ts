import { describe, expect, it } from "vitest";
import { contextShare, elapsedMs, findSelected, needsUser, sessionsOf, subagentCounts } from "./session";
import { session, snapshot, subagent, tokenUsage } from "./testFixtures";

describe("elapsedMs", () => {
  it("measures to now while live and to updatedAt once done", () => {
    expect(elapsedMs({ status: "running", startedAt: 1_000, updatedAt: 3_000 }, 10_000)).toBe(9_000);
    expect(elapsedMs({ status: "done", startedAt: 1_000, updatedAt: 3_000 }, 10_000)).toBe(2_000);
  });
  it("never goes negative (clock skew)", () => {
    expect(elapsedMs({ status: "idle", startedAt: 5_000, updatedAt: 5_000 }, 4_000)).toBe(0);
  });
});

describe("contextShare", () => {
  it("divides used by window, null when unknown", () => {
    expect(contextShare(tokenUsage(1, { contextUsed: 50_000, contextWindow: 200_000 }))).toBe(0.25);
    expect(contextShare(tokenUsage(1, { contextUsed: 50_000 }))).toBeNull();
    expect(contextShare(tokenUsage(1, { contextUsed: 300, contextWindow: 200 }))).toBe(1);
  });
});

describe("subagentCounts", () => {
  it("counts running and awaiting subagents", () => {
    const s = session({
      subagents: [
        subagent({ id: "a", status: "running" }),
        subagent({ id: "b", status: "running" }),
        subagent({ id: "c", status: "awaitingApproval" }),
        subagent({ id: "d", status: "done" }),
      ],
    });
    expect(subagentCounts(s)).toEqual({ total: 4, running: 2, awaiting: 1 });
  });
});

describe("needsUser", () => {
  it("is true when the session or any of its subagents awaits approval", () => {
    expect(needsUser(session({ status: "awaitingApproval" }))).toBe(true);
    expect(needsUser(session({ status: "running", subagents: [subagent({ status: "awaitingApproval" })] }))).toBe(true);
    expect(needsUser(session({ status: "running", subagents: [subagent({ status: "running" })] }))).toBe(false);
    expect(needsUser(session({ status: "error" }))).toBe(false);
  });
});

describe("house numbering", () => {
  const snap = snapshot([
    session({ id: "claude:late", startedAt: 9_000 }),
    session({ id: "codex:x", provider: "codex", startedAt: 1 }),
    session({ id: "claude:early", startedAt: 2_000 }),
  ]);

  it("orders a district oldest first", () => {
    expect(sessionsOf(snap, "claude").map((s) => s.id)).toEqual(["claude:early", "claude:late"]);
  });

  it("finds the selected session with its 1-based house number", () => {
    const found = findSelected(snap, "claude:late");
    expect(found?.houseNumber).toBe(2);
    expect(found?.meta.label).toBe("Claude Code");
    expect(findSelected(snap, "claude:missing")).toBeNull();
    expect(findSelected(null, "claude:late")).toBeNull();
  });
});
