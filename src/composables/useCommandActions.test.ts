import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { searchActions } from "../domain/search";
import { appViewNavigationActions, createTaskCommandAction, invokeCommandAction } from "./useCommandActions";

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

describe("createTaskCommandAction", () => {
  it("is searchable and becomes available when projects finish loading", () => {
    const createTask = vi.fn();
    const projectCount = ref(0);
    const loading = ref(true);
    const action = computed(() => createTaskCommandAction(createTask, projectCount.value, loading.value));

    expect(searchActions([action.value], "new task").map((match) => match.id)).toEqual(["create-task"]);
    expect(action.value.disabled).toBe(true);

    projectCount.value = 1;
    expect(action.value.disabled).toBe(true);

    loading.value = false;
    expect(action.value.disabled).toBe(false);

    action.value.run();
    expect(createTask).toHaveBeenCalledOnce();
  });
});

describe("invokeCommandAction", () => {
  it("does not close or run a disabled action", () => {
    const close = vi.fn();
    const run = vi.fn();

    expect(invokeCommandAction({ disabled: true, run }, close)).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("closes the palette before running an enabled action", () => {
    const close = vi.fn();
    const run = vi.fn(() => expect(close).toHaveBeenCalledOnce());

    expect(invokeCommandAction({ disabled: false, run }, close)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });
});
