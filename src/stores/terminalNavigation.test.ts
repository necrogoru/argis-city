import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAppViewStore } from "./appView";
import { useTerminalNavigationStore } from "./terminalNavigation";

describe("useTerminalNavigationStore", () => {
  it("opens and closes a task terminal without changing the current view", () => {
    setActivePinia(createPinia());
    const appView = useAppViewStore();
    const terminal = useTerminalNavigationStore();

    terminal.openTaskTerminal(42);

    expect(terminal.taskId).toBe(42);
    expect(terminal.open).toBe(true);
    expect(appView.activeView).toBe("city");

    terminal.closeTerminal();

    expect(terminal.taskId).toBe(42);
    expect(terminal.open).toBe(false);
    expect(appView.activeView).toBe("city");
  });

  it("clears the terminal target when its task is deleted", () => {
    setActivePinia(createPinia());
    const terminal = useTerminalNavigationStore();
    terminal.openTaskTerminal(42);

    terminal.clearTaskTerminal(42);

    expect(terminal.taskId).toBeNull();
    expect(terminal.open).toBe(false);
  });
});
