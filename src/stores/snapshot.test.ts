import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "../domain/types";
import { snapshot } from "../domain/testFixtures";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useSnapshotStore } from "./snapshot";

const at = (generatedAt: number): Snapshot => ({ ...snapshot([]), generatedAt });

/** AgentSource whose initial fetch and pushes the test controls. */
function fakeSource(refresh: () => Promise<Snapshot> = async () => at(99)) {
  let resolveInitial!: (s: Snapshot) => void;
  let rejectInitial!: (e: unknown) => void;
  let push: (s: Snapshot) => void = () => {};
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: () => new Promise<Snapshot>((res, rej) => ((resolveInitial = res), (rejectInitial = rej))),
    refresh: vi.fn(refresh),
    subscribe: (callback) => ((push = callback), () => {}),
    openPath: async () => {},
  };
  return { source, resolveInitial: (s: Snapshot) => resolveInitial(s), rejectInitial: (e: unknown) => rejectInitial(e), push: (s: Snapshot) => push(s) };
}

function storeWith(source: AgentSource) {
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  return app.runWithContext(() => useSnapshotStore());
}

describe("useSnapshotStore", () => {
  it("accepts pushed snapshots", () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.push(at(10));
    expect(store.snapshot?.generatedAt).toBe(10);
  });

  it("never lets a late initial fetch overwrite a newer pushed snapshot", async () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.push(at(20));
    fake.resolveInitial(at(10));
    await Promise.resolve();
    expect(store.snapshot?.generatedAt).toBe(20);
  });

  it("records a failed initial fetch, and the next snapshot clears it", async () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.rejectInitial(new Error("backend down"));
    await Promise.resolve();
    await Promise.resolve();
    expect(store.error).toBe("backend down");
    expect(store.snapshot).toBeNull();
    fake.push(at(30));
    expect(store.error).toBeNull();
  });

  it("refresh() accepts the fresh snapshot, or records its error", async () => {
    const ok = storeWith(fakeSource().source);
    await ok.refresh();
    expect(ok.snapshot?.generatedAt).toBe(99);

    const failing = storeWith(fakeSource(() => Promise.reject("nope")).source);
    await failing.refresh();
    expect(failing.error).toBe("nope");
  });
});
