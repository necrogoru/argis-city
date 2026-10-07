import { describe, expect, it } from "vitest";
import {
  filterSessions,
  groupSessions,
  statusCounts,
  toggleFilter,
  visibleChips,
} from "./agentList";
import { session, subagent } from "./testFixtures";

const sessions = [
  session({ id: "pi:1", provider: "pi", status: "idle", startedAt: 1 }),
  session({ id: "claude:old-run", status: "running", startedAt: 10 }),
  session({ id: "claude:wait", status: "awaitingApproval", startedAt: 50 }),
  session({ id: "claude:new-run", status: "running", startedAt: 20 }),
  session({ id: "claude:err", status: "error", startedAt: 5 }),
  session({ id: "codex:done", provider: "codex", status: "done", startedAt: 3 }),
  session({
    id: "codex:sub-wait",
    provider: "codex",
    status: "running",
    startedAt: 4,
    subagents: [subagent({ status: "awaitingApproval" })],
  }),
];

describe("statusCounts / visibleChips", () => {
  it("counts every status in display order", () => {
    expect(statusCounts(sessions)).toEqual([
      { status: "awaitingApproval", count: 2 },
      { status: "error", count: 1 },
      { status: "running", count: 3 },
      { status: "idle", count: 1 },
      { status: "done", count: 1 },
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
    expect(filterSessions(sessions, "running").map((s) => s.id)).toEqual([
      "claude:old-run",
      "claude:new-run",
      "codex:sub-wait",
    ]);
  });

  it("files a session whose subagent waits under 'Needs you'", () => {
    expect(filterSessions(sessions, "awaitingApproval").map((s) => s.id)).toEqual(["claude:wait", "codex:sub-wait"]);
  });
});

describe("groupSessions", () => {
  it("groups by provider in city order and skips empty groups", () => {
    expect(groupSessions(sessions, null).map((g) => g.provider)).toEqual(["claude", "codex", "pi"]);
  });

  it("sorts 'needs you' first, then error, then running (oldest first)", () => {
    const claude = groupSessions(sessions, null)[0];
    expect(claude.sessions.map((s) => s.id)).toEqual([
      "claude:wait",
      "claude:err",
      "claude:old-run",
      "claude:new-run",
    ]);
  });

  it("sorts a session with a waiting subagent with 'needs you'", () => {
    const codex = groupSessions(sessions, null)[1];
    expect(codex.sessions.map((s) => s.id)).toEqual(["codex:sub-wait", "codex:done"]);
  });

  it("applies the status filter before grouping", () => {
    const groups = groupSessions(sessions, "awaitingApproval");
    expect(groups.map((g) => g.provider)).toEqual(["claude", "codex"]);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["claude:wait"]);
    expect(groupSessions(sessions, "done").map((g) => g.provider)).toEqual(["codex"]);
  });
});
