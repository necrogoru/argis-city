import { describe, expect, it } from "vitest";
import type { AgentStatus } from "../../domain/types";
import { createSeedSnapshot } from "./mockAgentSource";
import { FLIP_EVERY, flipStatus, tickSnapshot } from "./mockTick";

const count = (provider: string, snap = createSeedSnapshot(0)) =>
  snap.sessions.filter((s) => s.provider === provider).length;

describe("mock seed", () => {
  it("has the 5 / 4 / 3 / 2 provider split", () => {
    expect([count("claude"), count("codex"), count("opencode"), count("pi")]).toEqual([5, 4, 3, 2]);
  });

  it("covers every subagent status", () => {
    const statuses = new Set<AgentStatus>(
      createSeedSnapshot(0).sessions.flatMap((s) => s.subagents.map((a) => a.status)),
    );
    expect([...statuses].sort()).toEqual(["awaitingApproval", "done", "error", "idle", "running"]);
  });

  it("gives sessions every status, with 'needs you' in several districts", () => {
    const sessions = createSeedSnapshot(0).sessions;
    expect(new Set(sessions.map((s) => s.status)).size).toBe(5);
    const awaiting = sessions.filter((s) => s.status === "awaitingApproval");
    expect(new Set(awaiting.map((s) => s.provider)).size).toBeGreaterThanOrEqual(3);
  });

  it("follows the contract id and progress rules", () => {
    for (const session of createSeedSnapshot(0).sessions) {
      expect(session.id.startsWith(`${session.provider}:`)).toBe(true);
      if (session.progress.source === "none") expect(session.progress.percent).toBeNull();
    }
  });

  it("supports an empty scenario with an uninstalled provider", () => {
    const empty = createSeedSnapshot(0, "empty");
    expect(empty.sessions).toHaveLength(0);
    expect(empty.providers.find((p) => p.provider === "pi")?.available).toBe(false);
  });
});

describe("tickSnapshot", () => {
  it("keeps session ids stable, bumps generatedAt and only grows tokens", () => {
    const seed = createSeedSnapshot(0);
    let rolls = 0;
    const next = tickSnapshot(seed, 2_000, () => (rolls++ % 10) / 10);
    expect(next.generatedAt).toBe(2_000);
    expect(next.sessions.map((s) => s.id)).toEqual(seed.sessions.map((s) => s.id));
    next.sessions.forEach((s, i) => expect(s.tokens.total).toBeGreaterThanOrEqual(seed.sessions[i].tokens.total));
  });

  it("preserves provider availability across ticks", () => {
    const next = tickSnapshot(createSeedSnapshot(0, "empty"), 2_000, () => 0.5);
    expect(next.providers.find((p) => p.provider === "pi")?.available).toBe(false);
  });
});

describe("status flips", () => {
  it("cycles running into needs-you / done / error and back", () => {
    expect([0, 1, 2, 3].map((v) => flipStatus("running", v))).toEqual([
      "awaitingApproval",
      "done",
      "awaitingApproval",
      "error",
    ]);
    expect(flipStatus("awaitingApproval", 0)).toBe("running");
    expect(flipStatus("done", 0)).toBe("idle");
    expect(flipStatus("idle", 0)).toBe("running");
  });

  it("flips exactly one session every few ticks", () => {
    const seed = createSeedSnapshot(0);
    const still = () => 0.99; // no random transitions
    const changed = (tick: number) =>
      tickSnapshot(seed, 2_000, still, tick).sessions.filter((s, i) => s.status !== seed.sessions[i].status);
    expect(changed(FLIP_EVERY - 1)).toHaveLength(0);
    expect(changed(FLIP_EVERY)).toHaveLength(1);
  });
});
