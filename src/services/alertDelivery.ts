export type AlertKind = "approval" | "completion" | "terminalExit";

export interface AlertDeliveryRequest {
  kind: AlertKind;
  title: string;
  body: string;
}

export interface NotificationRequest {
  title: string;
  body: string;
  sound: "Ping";
}

export interface AlertDeliveryAdapters {
  notifications: {
    isPermissionGranted(): Promise<boolean>;
    requestPermission(): Promise<NotificationPermission>;
    sendNotification(request: NotificationRequest): void | Promise<void>;
  };
  playAlertSound(kind: AlertKind): void | Promise<void>;
  onError?(channel: "notification" | "sound", error: unknown): void;
}

export interface AlertDelivery {
  deliver(alert: AlertDeliveryRequest): Promise<void>;
}

export function createNoopAlertDelivery(): AlertDelivery {
  return { deliver: async () => {} };
}

type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

/** Isolates native notifications from their independent audible fallback. */
export function createAlertDelivery(adapters: AlertDeliveryAdapters): AlertDelivery {
  let permissionState: PermissionState = "unknown";
  let permissionRequest: Promise<boolean> | null = null;
  const onError = adapters.onError ?? ((channel, error) => console.error(`[argis] ${channel} delivery failed`, error));

  function requestNotificationPermission(): Promise<boolean> {
    if (permissionState === "granted") return Promise.resolve(true);
    if (permissionState === "denied" || permissionState === "unavailable") return Promise.resolve(false);
    if (permissionRequest) return permissionRequest;

    permissionRequest = (async () => {
      try {
        if (await adapters.notifications.isPermissionGranted()) {
          permissionState = "granted";
          return true;
        }

        permissionState = (await adapters.notifications.requestPermission()) === "granted" ? "granted" : "denied";
        return permissionState === "granted";
      } catch (error) {
        permissionState = "unavailable";
        onError("notification", error);
        return false;
      } finally {
        permissionRequest = null;
      }
    })();
    return permissionRequest;
  }

  async function playFallback(kind: AlertKind): Promise<void> {
    try {
      await adapters.playAlertSound(kind);
    } catch (error) {
      onError("sound", error);
    }
  }

  return {
    async deliver(alert) {
      if (!(await requestNotificationPermission())) {
        await playFallback(alert.kind);
        return;
      }

      try {
        await adapters.notifications.sendNotification({ title: alert.title, body: alert.body, sound: "Ping" });
      } catch (error) {
        onError("notification", error);
        await playFallback(alert.kind);
      }
    },
  };
}
