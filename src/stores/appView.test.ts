import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useAppViewStore } from "./appView";

function setup() {
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia);
  setActivePinia(pinia);
  return app.runWithContext(() => useAppViewStore());
}

describe("useAppViewStore", () => {
  it("starts in the agent city", () => {
    expect(setup().activeView).toBe("city");
  });

  it("switches between monitoring and the optional task workspace", () => {
    const store = setup();

    store.showTasks();
    expect(store.activeView).toBe("tasks");

    store.showCity();
    expect(store.activeView).toBe("city");
  });

  it("routes task creation from Dashboard and exposes the request once", () => {
    const store = setup();

    store.requestTaskCreation();

    expect(store.activeView).toBe("tasks");
    expect(store.consumeTaskCreationRequest()).toBe(true);
    expect(store.consumeTaskCreationRequest()).toBe(false);
  });

  it("requests task creation without leaving Tasks", () => {
    const store = setup();
    store.showTasks();

    store.requestTaskCreation();

    expect(store.activeView).toBe("tasks");
    expect(store.consumeTaskCreationRequest()).toBe(true);
  });
});
