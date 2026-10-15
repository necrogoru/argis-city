import { describe, expect, it } from "vitest";
import { Search } from "@lucide/vue";
import type { CommandAction } from "../../composables/useCommandActions";
import type { Project, Task } from "../../domain/types";
import { session } from "../../domain/testFixtures";
import { buildPaletteResults } from "./paletteResults";

const action = (id: string, label: string): CommandAction => ({
  id,
  label,
  keywords: [],
  Icon: Search,
  run: () => undefined,
});

const actions = [
  action("view:city", "Show Dashboard"),
  action("view:tasks", "Open Tasks"),
  action("zoom-in", "Zoom in"),
  action("refresh", "Refresh agents now"),
];

const sessions = [session({ id: "claude:billing", title: "Billing", model: "zoom", status: "running" })];
const projects: Project[] = [{ id: 1, path: "/Users/dev/zoom" }];
const tasks: Task[] = [
  {
    id: 17,
    projectId: 1,
    title: "Database review",
    description: "Review migrations",
    status: "pending",
    branchName: null,
    worktreePath: null,
  },
];

describe("buildPaletteResults", () => {
  it("shows only Open Tasks then Show Dashboard for an empty query", () => {
    const results = buildPaletteResults(sessions, tasks, projects, actions, "  ");

    expect(results.map((result) => result.key)).toEqual(["action:view:tasks", "action:view:city"]);
  });

  it("ranks actions, agents, and tasks together by match quality", () => {
    const results = buildPaletteResults(sessions, tasks, projects, actions, "zoom");

    expect(results.map((result) => result.key)).toEqual([
      "action:zoom-in",
      "agent:claude:billing",
      "task:17",
    ]);
  });

  it("does not restore default actions for an unmatched non-empty query", () => {
    const results = buildPaletteResults(sessions, tasks, projects, actions, "øøø");

    expect(results).toEqual([]);
  });
});
