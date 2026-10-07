import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "../domain/types";
import { session, snapshot } from "../domain/testFixtures";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useSelectionStore } from "./selection";

function setup() {
  let push: (s: Snapshot) => void = () => {};
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: () => new Promise<Snapshot>(() => {}),
    refresh: async () => snapshot([]),
    subscribe: (callback) => ((push = callback), () => {}),
    openPath: async () => {},
  };
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const store = app.runWithContext(() => useSelectionStore());
  let tick = 0;
  /** Push a snapshot with a strictly newer generatedAt each time. */
  const show = (...ids: string[]) => push({ ...snapshot(ids.map((id) => session({ id }))), generatedAt: (tick += 1) });
  return { store, show };
}

describe("useSelectionStore", () => {
  it("selects a live session and resolves its house", () => {
    const { store, show } = setup();
    show("claude:a", "claude:b");
    store.selectSession("claude:b");
    expect(store.selection.sessionId).toBe("claude:b");
    expect(store.selectedSession?.houseNumber).toBe(2);
  });

  it("drops a vanished session and never resurrects it when it returns", () => {
    const { store, show } = setup();
    show("claude:a");
    store.selectSession("claude:a");
    show();
    expect(store.selection.sessionId).toBeNull();
    show("claude:a");
    expect(store.selection.sessionId).toBeNull();
  });

  it("Escape peels the house first, then the district", () => {
    const { store, show } = setup();
    show("claude:a");
    store.focusProvider("claude");
    store.selectSession("claude:a");
    store.escape();
    expect(store.selection).toEqual({ sessionId: null, provider: "claude" });
    store.escape();
    expect(store.selection).toEqual({ sessionId: null, provider: null });
  });

  it("toggling the focused district again clears it", () => {
    const { store } = setup();
    store.toggleProvider("codex");
    expect(store.selection.provider).toBe("codex");
    store.toggleProvider("codex");
    expect(store.selection.provider).toBeNull();
  });

  it("toggles the list's status filter", () => {
    const { store } = setup();
    store.toggleStatusFilter("running");
    expect(store.statusFilter).toBe("running");
    store.toggleStatusFilter("running");
    expect(store.statusFilter).toBeNull();
  });

  it("'Needs you' closes the house and filters the list to what waits on the user", () => {
    const { store, show } = setup();
    show("claude:a");
    store.selectSession("claude:a");
    store.showNeedsYou();
    expect(store.selection.sessionId).toBeNull();
    expect(store.statusFilter).toBe("awaitingApproval");
    store.clearStatusFilter();
    expect(store.statusFilter).toBeNull();
  });
});
