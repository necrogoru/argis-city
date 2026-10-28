import { describe, expect, it } from "vitest";
import { highlight, scoreFields, searchActions, searchSessions, searchTasks, tokenize, wrapIndex } from "./search";
import type { Project, Task } from "./types";
import { session } from "./testFixtures";

const sessions = [
  session({ id: "claude:argis", title: "argis", status: "running", startedAt: 10 }),
  session({ id: "codex:web", provider: "codex", title: "web-app", model: "gpt-5", status: "idle", startedAt: 5, cwd: "/Users/dev/web" }),
  session({ id: "claude:api", title: "billing-api", status: "awaitingApproval", startedAt: 20, cwd: "/Users/dev/work/argis-api" }),
  session({ id: "pi:docs", provider: "pi", title: "docs", status: "done", startedAt: 1, cwd: "/Users/dev/docs", currentStep: "Writing the web guide" }),
];

const ids = <T extends { id: string | number }>(list: T[]) => list.map((item) => item.id);

const projects: Project[] = [
  { id: 1, path: "/Users/dev/argis" },
  { id: 2, path: "/Users/dev/payment-service" },
];
const tasks: Task[] = [
  {
    id: 17,
    projectId: 1,
    title: "Add navigation shortcuts",
    description: "Switch between city and tasks",
    status: "inProgress",
    branchName: null,
    worktreePath: null,
    images: [],
  },
  {
    id: 18,
    projectId: 2,
    title: "Search command palette",
    description: "Find tasks by project path",
    status: "pending",
    branchName: "argis/18-search-command-palette",
    worktreePath: "/Users/dev/payment-service/.argis/worktrees/18-search-command-palette",
    images: [],
  },
];

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

  it("matches case-insensitive subsequences with omitted characters", () => {
    expect(scoreFields(["optsk"], [{ text: "oPEn TaSkS", weight: 1 }])).not.toBeNull();
  });

  it("requires every query token to match a searchable field", () => {
    const fields = [{ text: "Open Tasks", weight: 1 }, { text: "Dashboard", weight: 1 }];
    expect(scoreFields(["op", "tsk"], fields)).not.toBeNull();
    expect(scoreFields(["op", "missing"], fields)).toBeNull();
  });

  it("scores prefix and word-boundary subsequences above weak interior matches", () => {
    const score = (text: string) => scoreFields(["ot"], [{ text, weight: 1 }]) ?? 0;
    expect(score("Open Tasks")).toBeGreaterThan(score("soft"));
  });

  it("ranks a contiguous interior hit above a non-contiguous prefix hit", () => {
    const score = (text: string) => scoreFields(["ab"], [{ text, weight: 1 }]) ?? 0;
    expect(score("xxab")).toBeGreaterThan(score("a---b"));
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

describe("searchTasks", () => {
  it("matches task IDs, titles, descriptions, and project paths", () => {
    expect(ids(searchTasks(tasks, projects, "18"))).toEqual([18]);
    expect(ids(searchTasks(tasks, projects, "navigation"))).toEqual([17]);
    expect(ids(searchTasks(tasks, projects, "city tasks"))).toEqual([17]);
    expect(ids(searchTasks(tasks, projects, "payment-service"))).toEqual([18]);
  });

  it("ranks title matches above lower-priority task context", () => {
    const rankedTasks = [
      { ...tasks[0], description: "Search all project tasks" },
      { ...tasks[1], title: "Search command palette", description: "Task records" },
    ];
    const matches = searchTasks(rankedTasks, projects, "search");

    expect(ids(matches)).toEqual([18, 17]);
  });

  it("requires all query tokens and returns no tasks for an empty query", () => {
    expect(searchTasks(tasks, projects, "navigation missing")).toEqual([]);
    expect(searchTasks(tasks, projects, " ")).toEqual([]);
  });

  it("matches terminal terms only for tasks with a worktree", () => {
    expect(ids(searchTasks(tasks, projects, "terminal"))).toEqual([18]);
    expect(ids(searchTasks(tasks, projects, "shell"))).toEqual([18]);
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

  it("highlights the matched characters of a fuzzy subsequence", () => {
    expect(highlight("Open Tasks", "optsk")).toEqual([
      { text: "Op", match: true },
      { text: "en ", match: false },
      { text: "T", match: true },
      { text: "a", match: false },
      { text: "sk", match: true },
      { text: "s", match: false },
    ]);
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
