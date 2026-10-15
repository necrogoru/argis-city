import { describe, expect, it, vi } from "vitest";
import { searchActions } from "../domain/search";
import { appViewNavigationActions } from "./useCommandActions";

describe("appViewNavigationActions", () => {
  it("makes Dashboard and Tasks searchable and invokes their navigation actions", () => {
    const showCity = vi.fn();
    const showTasks = vi.fn();
    const actions = appViewNavigationActions(showCity, showTasks);

    expect(searchActions(actions, "dashboard").map((action) => action.id)).toEqual(["view:city"]);
    expect(searchActions(actions, "workspace").map((action) => action.id)).toEqual(["view:tasks"]);
    expect(actions.map((action) => action.hint)).toEqual([undefined, undefined]);

    actions.find((action) => action.id === "view:city")?.run();
    actions.find((action) => action.id === "view:tasks")?.run();

    expect(showCity).toHaveBeenCalledOnce();
    expect(showTasks).toHaveBeenCalledOnce();
  });

  it("uses the caller's platform modifier label", () => {
    const actions = appViewNavigationActions(() => {}, () => {});

    expect(actions.map((action) => action.hint)).toEqual([undefined, undefined]);
    expect(searchActions(actions, "tasks").map((action) => action.id)).toEqual(["view:tasks"]);
  });
});
