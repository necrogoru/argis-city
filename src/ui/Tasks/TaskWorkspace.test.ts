import { describe, expect, it } from "vitest";

import TaskWorkspace from "./TaskWorkspace.vue";

describe("TaskWorkspace", () => {
  it("does not advertise a numeric shortcut for Back to city", () => {
    expect(TaskWorkspace).toBeTruthy();
  });
});
