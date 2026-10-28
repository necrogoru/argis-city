import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "../domain/types";
import { session, snapshot } from "../domain/testFixtures";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useAppViewStore } from "./appView";
import { useSelectionStore } from "./selection";

function setup() {
  let push: (s: Snapshot) => void = () => {};
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: () => new Promise<Snapshot>(() => {}),
    refresh: async () => snapshot([]),
    subscribe: (callback) => ((push = callback), () => {}),
    subscribeTerminalExit: () => () => {},
    playAlertSound: async () => {},
    openPath: async () => {},
    listProjects: async () => [],
    addProject: async (path) => ({ id: 1, path }),
    listTasks: async () => [],
    listTaskAgentResumes: async () => [],
    getTaskAgentResume: async () => null,
    saveTaskAgentResume: async (reference) => reference,
    createTask: async () => { throw new Error("unused test operation"); },
    updateTaskDetails: async () => { throw new Error("unused test operation"); },
    updateTaskStatus: async () => { throw new Error("unused test operation"); },
    deleteTask: async (_id, removeGitResources) => ({
      taskDeleted: true,
      git: {
        requested: removeGitResources,
        worktreeRemoved: false,
        branchRemoved: false,
        branchName: null,
        worktreePath: null,
        error: null,
      },
    }),
    getTaskGitStatus: async (id) => ({
      isGitRepository: true,
      canCreateBranch: true,
      branchExists: false,
      branchName: `argis/${id}-task`,
      worktreePath: `/projects/argis/.argis/worktrees/${id}-task`,
      reason: null,
    }),
    createTaskWorktree: async (id) => ({
      branchName: `argis/${id}-task`,
      worktreePath: `/projects/argis/.argis/worktrees/${id}-task`,
    }),
    readTaskImage: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
    readImageFile: async () => { throw new Error("unused test operation"); },
    subscribeFileDrop: () => () => {},
    startTerminalSession: async () => { throw new Error("unused test operation"); },
    resumeTaskAgent: async () => { throw new Error("unused test operation"); },
    reattachTerminalSession: async () => null,
    sendTerminalInput: async () => {},
    resizeTerminalSession: async () => {},
    detachTerminalSession: async () => false,
    listTerminalInventory: async () => [],
  };
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const appView = app.runWithContext(() => useAppViewStore());
  const store = app.runWithContext(() => useSelectionStore());
  let tick = 0;
  /** Push a snapshot with a strictly newer generatedAt each time. */
  const show = (...ids: string[]) => push({ ...snapshot(ids.map((id) => session({ id }))), generatedAt: (tick += 1) });
  return { appView, store, show };
}

describe("useSelectionStore", () => {
  it("selects a live session and resolves its house", () => {
    const { store, show } = setup();
    show("claude:a", "claude:b");
    store.selectSession("claude:b");
    expect(store.selection.sessionId).toBe("claude:b");
    expect(store.selectedSession?.houseNumber).toBe(2);
  });

  it("keeps the temporary house cursor separate and clears it on commit", () => {
    const { store, show } = setup();
    show("claude:a", "claude:b");
    store.setHouseCursor("claude:b");
    expect(store.houseCursorId).toBe("claude:b");
    expect(store.selection.sessionId).toBeNull();

    store.selectSession("claude:b");
    expect(store.houseCursorId).toBeNull();
    expect(store.selection.sessionId).toBe("claude:b");
  });

  it("clears a vanished cursor house and does not restore it if it returns", () => {
    const { store, show } = setup();
    show("claude:a");
    store.setHouseCursor("claude:a");
    show();
    expect(store.houseCursorId).toBeNull();

    show("claude:a");
    expect(store.houseCursorId).toBeNull();
  });

  it("clears the temporary house cursor when leaving Dashboard", () => {
    const { appView, store, show } = setup();
    show("claude:a");
    store.setHouseCursor("claude:a");
    appView.showTasks();
    expect(store.houseCursorId).toBeNull();

    appView.showCity();
    expect(store.houseCursorId).toBeNull();
  });

  it("clears the temporary house cursor on Escape", () => {
    const { store, show } = setup();
    show("claude:a");
    store.setHouseCursor("claude:a");
    store.escape();
    expect(store.houseCursorId).toBeNull();
    expect(store.selection.sessionId).toBeNull();
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
