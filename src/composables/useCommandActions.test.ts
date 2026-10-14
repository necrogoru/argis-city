import { describe, expect, it, vi } from "vitest";
import { searchActions } from "../domain/search";
import { appViewNavigationActions } from "./useCommandActions";

describe("appViewNavigationActions", () => {
  it("makes Dashboard and Tasks searchable and invokes their navigation actions", () => {
    const showCity = vi.fn();
    const showTasks = vi.fn();
    const actions = appViewNavigationActions(showCity, showTasks, (key) => `⌘${key}`);

    expect(searchActions(actions, "dashboard").map((action) => action.id)).toEqual(["view:city"]);
    expect(searchActions(actions, "⌘1").map((action) => action.id)).toEqual(["view:city"]);
    expect(searchActions(actions, "workspace").map((action) => action.id)).toEqual(["view:tasks"]);
    expect(actions.map((action) => action.hint)).toEqual(["⌘1", "⌘2"]);

    actions.find((action) => action.id === "view:city")?.run();
    actions.find((action) => action.id === "view:tasks")?.run();

    expect(showCity).toHaveBeenCalledOnce();
    expect(showTasks).toHaveBeenCalledOnce();
  });

  it("uses the caller's platform modifier label", () => {
    const actions = appViewNavigationActions(() => {}, () => {}, (key) => `Ctrl+${key}`);

    expect(actions.map((action) => action.hint)).toEqual(["Ctrl+1", "Ctrl+2"]);
    expect(searchActions(actions, "Ctrl+2").map((action) => action.id)).toEqual(["view:tasks"]);
  });
});
