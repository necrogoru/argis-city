import { describe, expect, it } from "vitest";
import {
  filterSessions,
  groupSessions,
  statusCounts,
  toggleFilter,
  visibleChips,
} from "./agentList";
import { session } from "./testFixtures";

const sessions = [
  session({ id: "pi:1", provider: "pi", status: "idle", startedAt: 1 }),
  session({ id: "claude:old-run", status: "running", startedAt: 10 }),
  session({ id: "claude:wait", status: "awaitingApproval", startedAt: 50 }),
  session({ id: "claude:new-run", status: "running", startedAt: 20 }),
  session({ id: "claude:err", status: "error", startedAt: 5 }),
  session({ id: "codex:done", provider: "codex", status: "done", startedAt: 3 }),
];

describe("statusCounts / visibleChips", () => {
  it("counts every status in display order", () => {
    expect(statusCounts(sessions)).toEqual([
      { status: "awaitingApproval", count: 1 },
      { status: "running", count: 2 },
      { status: "idle", count: 1 },
      { status: "done", count: 1 },
      { status: "error", count: 1 },
    ]);
  });

  it("hides zero chips unless that status is the active filter", () => {
    const counts = statusCounts(sessions.filter((s) => s.status !== "error"));
    expect(visibleChips(counts, null).map((c) => c.status)).not.toContain("error");
    expect(visibleChips(counts, "error").map((c) => c.status)).toContain("error");
  });
});

describe("filtering", () => {
  it("toggles a chip on and off", () => {
    expect(toggleFilter(null, "running")).toBe("running");
    expect(toggleFilter("running", "running")).toBeNull();
    expect(toggleFilter("running", "idle")).toBe("idle");
  });

  it("returns all sessions without a filter, matching ones with it", () => {
    expect(filterSessions(sessions, null)).toHaveLength(sessions.length);
    expect(filterSessions(sessions, "running").map((s) => s.id)).toEqual(["claude:old-run", "claude:new-run"]);
  });
});

describe("groupSessions", () => {
  it("groups by provider in city order and skips empty groups", () => {
    expect(groupSessions(sessions, null).map((g) => g.provider)).toEqual(["claude", "codex", "pi"]);
  });

  it("sorts 'needs you' first, then running (oldest first), then error", () => {
    const claude = groupSessions(sessions, null)[0];
    expect(claude.sessions.map((s) => s.id)).toEqual([
      "claude:wait",
      "claude:old-run",
      "claude:new-run",
      "claude:err",
    ]);
  });

  it("applies the status filter before grouping", () => {
    const groups = groupSessions(sessions, "awaitingApproval");
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["claude:wait"]);
    expect(groupSessions(sessions, "done").map((g) => g.provider)).toEqual(["codex"]);
  });
});
