import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertDelivery, type AlertDeliveryRequest } from "./alertDelivery";

const alert: AlertDeliveryRequest = {
  kind: "approval",
  title: "Approval needed",
  body: "Claude Code · argis",
};

function ports() {
  return {
    notifications: {
      isPermissionGranted: vi.fn<() => Promise<boolean>>(),
      requestPermission: vi.fn<() => Promise<NotificationPermission>>(),
      sendNotification: vi.fn(),
    },
    playAlertSound: vi.fn<() => Promise<void>>(),
    onError: vi.fn(),
  };
}

describe("createAlertDelivery", () => {
  let adapters: ReturnType<typeof ports>;

  beforeEach(() => {
    adapters = ports();
  });

  it("sends a native Ping notification when permission is already granted", async () => {
    adapters.notifications.isPermissionGranted.mockResolvedValue(true);
    const delivery = createAlertDelivery(adapters);

    await delivery.deliver(alert);

    expect(adapters.notifications.requestPermission).not.toHaveBeenCalled();
    expect(adapters.notifications.sendNotification).toHaveBeenCalledWith({
      title: alert.title,
      body: alert.body,
      sound: "Ping",
    });
    expect(adapters.playAlertSound).not.toHaveBeenCalled();
  });

  it("requests permission only when needed and sends after it is granted", async () => {
    adapters.notifications.isPermissionGranted.mockResolvedValue(false);
    adapters.notifications.requestPermission.mockResolvedValue("granted");
    const delivery = createAlertDelivery(adapters);

    await delivery.deliver(alert);

    expect(adapters.notifications.requestPermission).toHaveBeenCalledOnce();
    expect(adapters.notifications.sendNotification).toHaveBeenCalledOnce();
    expect(adapters.playAlertSound).not.toHaveBeenCalled();
  });

  it("shares a single in-flight permission request across concurrent alerts", async () => {
    adapters.notifications.isPermissionGranted.mockResolvedValue(false);
    adapters.notifications.requestPermission.mockResolvedValue("granted");
    const delivery = createAlertDelivery(adapters);

    await Promise.all([delivery.deliver(alert), delivery.deliver({ ...alert, title: "Run complete" })]);

    expect(adapters.notifications.requestPermission).toHaveBeenCalledOnce();
    expect(adapters.notifications.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("plays the independent fallback after denial and does not prompt again", async () => {
    adapters.notifications.isPermissionGranted.mockResolvedValue(false);
    adapters.notifications.requestPermission.mockResolvedValue("denied");
    adapters.playAlertSound.mockResolvedValue();
    const delivery = createAlertDelivery(adapters);

    await delivery.deliver(alert);
    await delivery.deliver(alert);

    expect(adapters.notifications.isPermissionGranted).toHaveBeenCalledOnce();
    expect(adapters.notifications.requestPermission).toHaveBeenCalledOnce();
    expect(adapters.notifications.sendNotification).not.toHaveBeenCalled();
    expect(adapters.playAlertSound).toHaveBeenCalledTimes(2);
  });

  it("falls back to sound when notification permission is unavailable", async () => {
    adapters.notifications.isPermissionGranted.mockRejectedValue(new Error("plugin unavailable"));
    adapters.playAlertSound.mockResolvedValue();
    const delivery = createAlertDelivery(adapters);

    await delivery.deliver(alert);

    expect(adapters.notifications.requestPermission).not.toHaveBeenCalled();
    expect(adapters.notifications.sendNotification).not.toHaveBeenCalled();
    expect(adapters.playAlertSound).toHaveBeenCalledOnce();
    expect(adapters.onError).toHaveBeenCalledWith("notification", expect.any(Error));
  });

  it("isolates notification and sound failures from alert processing", async () => {
    adapters.notifications.isPermissionGranted.mockResolvedValue(true);
    adapters.notifications.sendNotification.mockImplementation(() => {
      throw new Error("notification delivery failed");
    });
    adapters.playAlertSound.mockRejectedValue(new Error("sound playback failed"));
    const delivery = createAlertDelivery(adapters);

    await expect(delivery.deliver(alert)).resolves.toBeUndefined();

    expect(adapters.playAlertSound).toHaveBeenCalledOnce();
    expect(adapters.onError).toHaveBeenCalledWith("notification", expect.any(Error));
    expect(adapters.onError).toHaveBeenCalledWith("sound", expect.any(Error));
  });
});
