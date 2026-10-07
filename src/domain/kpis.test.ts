import { describe, expect, it } from "vitest";
import { computeKpis, EMPTY_KPIS } from "./kpis";
import { session, snapshot, subagent, tokenUsage } from "./testFixtures";

describe("computeKpis", () => {
  it("returns zeros without a snapshot", () => {
    expect(computeKpis(null)).toEqual(EMPTY_KPIS);
  });

  it("aggregates sessions and subagents", () => {
    const snap = snapshot([
      session({
        id: "claude:a",
        status: "awaitingApproval",
        tokens: tokenUsage(10_000),
        subagents: [
          subagent({ id: "s1", status: "running", tokens: tokenUsage(500) }),
          subagent({ id: "s2", status: "awaitingApproval", tokens: tokenUsage(250) }),
          subagent({ id: "s3", status: "done", tokens: tokenUsage(250) }),
        ],
      }),
      session({ id: "codex:b", provider: "codex", status: "idle", tokens: tokenUsage(4_000) }),
      session({
        id: "codex:c",
        provider: "codex",
        status: "running",
        tokens: tokenUsage(0),
        subagents: [subagent({ id: "s4", status: "awaitingApproval", tokens: tokenUsage(0) })],
      }),
    ]);

    // "Needs you" counts sessions (a: itself and a subagent; c: a subagent), not subagents.
    expect(computeKpis(snap)).toEqual({
      activeAgents: 3,
      subagents: 4,
      runningSubagents: 1,
      totalTokens: 15_000,
      awaiting: 2,
    });
  });
});
