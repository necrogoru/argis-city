import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { AgentStatus } from "../domain/types";
import { useDoneRipple } from "./useDoneRipple";

describe("useDoneRipple", () => {
  it("counts each transition into done, never the initial status", async () => {
    const status = ref<AgentStatus>("done");
    const ripples = useDoneRipple(() => status.value);
    expect(ripples.value).toBe(0);
    status.value = "running";
    await nextTick();
    status.value = "done";
    await nextTick();
    expect(ripples.value).toBe(1);
    status.value = "idle";
    await nextTick();
    expect(ripples.value).toBe(1);
  });
});
