import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AgentSource } from "./agentSource";
import { createAlertDelivery } from "./alertDelivery";

/** Builds the live delivery service from Tauri's notification API and the bundled alert sound. */
export function createTauriAlertDelivery(source: Pick<AgentSource, "playAlertSound">) {
  return createAlertDelivery({
    notifications: {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    },
    playAlertSound: () => source.playAlertSound(),
  });
}
