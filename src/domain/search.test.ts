import { describe, expect, it } from "vitest";
import { highlight, scoreFields, searchActions, searchSessions, tokenize, wrapIndex } from "./search";
import { session } from "./testFixtures";

const sessions = [
  session({ id: "claude:argis", title: "argis", status: "running", startedAt: 10 }),
  session({ id: "codex:web", provider: "codex", title: "web-app", model: "gpt-5", status: "idle", startedAt: 5, cwd: "/Users/dev/web" }),
  session({ id: "claude:api", title: "billing-api", status: "awaitingApproval", startedAt: 20, cwd: "/Users/dev/work/argis-api" }),
  session({ id: "pi:docs", provider: "pi", title: "docs", status: "done", startedAt: 1, cwd: "/Users/dev/docs", currentStep: "Writing the web guide" }),
];

const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe("tokenize", () => {
  it("lower-cases and splits on whitespace", () => {
    expect(tokenize("  Fit   CITY ")).toEqual(["fit", "city"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("scoreFields", () => {
  it("ranks prefix over word start over substring", () => {
    const score = (text: string) => scoreFields(["app"], [{ text, weight: 1 }]);
    expect(score("apple")).toBe(3);
    expect(score("web-app")).toBe(2);
    expect(score("webapp")).toBe(1);
  });

  it("requires every token to match somewhere", () => {
    const fields = [{ text: "argis", weight: 2 }, { text: "Claude Code", weight: 1 }];
    expect(scoreFields(["arg", "claude"], fields)).toBe(6 + 3);
    expect(scoreFields(["arg", "codex"], fields)).toBeNull();
  });
});

describe("searchSessions", () => {
  it("lists the most urgent sessions first when the query is empty", () => {
    expect(ids(searchSessions(sessions, ""))).toEqual(["claude:api", "claude:argis", "codex:web", "pi:docs"]);
    expect(ids(searchSessions(sessions, " ", 2))).toEqual(["claude:api", "claude:argis"]);
  });

  it("puts title hits above directory hits", () => {
    expect(ids(searchSessions(sessions, "argis"))).toEqual(["claude:argis", "claude:api"]);
  });

  it("matches provider, status, model and current step", () => {
    expect(ids(searchSessions(sessions, "codex"))).toEqual(["codex:web"]);
    expect(ids(searchSessions(sessions, "needs"))).toEqual(["claude:api"]);
    expect(ids(searchSessions(sessions, "gpt"))).toEqual(["codex:web"]);
    expect(ids(searchSessions(sessions, "guide"))).toEqual(["pi:docs"]);
  });

  it("narrows with every extra word", () => {
    expect(ids(searchSessions(sessions, "web"))).toEqual(["codex:web", "pi:docs"]);
    expect(ids(searchSessions(sessions, "web idle"))).toEqual(["codex:web"]);
    expect(searchSessions(sessions, "zzz")).toEqual([]);
  });
});

describe("searchActions", () => {
  const actions = [
    { id: "zoom-in", label: "Zoom in", keywords: ["view", "closer"] },
    { id: "fit", label: "Fit city to view", keywords: ["camera", "overview"] },
    { id: "reset", label: "Reset view angle", keywords: ["camera"] },
  ];

  it("keeps the given order for an empty query", () => {
    expect(ids(searchActions(actions, ""))).toEqual(["zoom-in", "fit", "reset"]);
  });

  it("ranks label hits above keyword hits and keeps ties stable", () => {
    expect(ids(searchActions(actions, "view"))).toEqual(["fit", "reset", "zoom-in"]);
    expect(ids(searchActions(actions, "camera"))).toEqual(["fit", "reset"]);
    expect(ids(searchActions(actions, "overview"))).toEqual(["fit"]);
  });
});

describe("highlight", () => {
  it("marks every case-insensitive occurrence of each token", () => {
    expect(highlight("Web App web", "WEB")).toEqual([
      { text: "Web", match: true },
      { text: " App ", match: false },
      { text: "web", match: true },
    ]);
  });

  it("merges overlapping and adjacent tokens", () => {
    expect(highlight("argis", "arg gis")).toEqual([{ text: "argis", match: true }]);
  });

  it("returns the text unmarked for an empty query", () => {
    expect(highlight("argis", "")).toEqual([{ text: "argis", match: false }]);
  });
});

describe("wrapIndex", () => {
  it("wraps at both ends and handles empty lists", () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(1, 1, 3)).toBe(2);
    expect(wrapIndex(0, 1, 0)).toBe(-1);
  });
});
