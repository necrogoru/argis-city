import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriAlertDelivery } from "./tauriAlertDelivery";

const { plugin } = vi.hoisted(() => ({
  plugin: {
    isPermissionGranted: vi.fn(),
    requestPermission: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-notification", () => plugin);

describe("createTauriAlertDelivery", () => {
  beforeEach(() => {
    plugin.isPermissionGranted.mockReset();
    plugin.requestPermission.mockReset();
    plugin.sendNotification.mockReset();
  });

  it("uses the macOS Ping notification sound and the AgentSource fallback", async () => {
    plugin.isPermissionGranted.mockResolvedValue(true);
    const source = { playAlertSound: vi.fn<() => Promise<void>>() };
    const delivery = createTauriAlertDelivery(source);

    await delivery.deliver({ kind: "completion", title: "Run complete", body: "Codex · argis" });

    expect(plugin.sendNotification).toHaveBeenCalledWith({
      title: "Run complete",
      body: "Codex · argis",
      sound: "Ping",
    });
    expect(source.playAlertSound).not.toHaveBeenCalled();
  });

  it("uses AgentSource's system sound when macOS notification permission is denied", async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue("denied");
    const source = { playAlertSound: vi.fn<() => Promise<void>>().mockResolvedValue() };
    const delivery = createTauriAlertDelivery(source);

    await delivery.deliver({ kind: "approval", title: "Approval needed", body: "Claude Code · argis" });

    expect(plugin.sendNotification).not.toHaveBeenCalled();
    expect(source.playAlertSound).toHaveBeenCalledOnce();
  });
});
