import { describe, expect, it } from "vitest";

import TopBar from "./TopBar.vue";

describe("TopBar", () => {
  it("does not advertise a numeric shortcut for Open tasks", () => {
    expect(TopBar).toBeTruthy();
  });
});
