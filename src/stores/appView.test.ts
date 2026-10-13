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
});
