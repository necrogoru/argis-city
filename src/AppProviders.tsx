import type { ReactNode } from "react";
import type { AgentSource } from "./services/agentSource";
import { AgentSourceProvider } from "./state/AgentSourceContext";
import { SnapshotProvider } from "./state/SnapshotContext";
import { SelectionProvider } from "./state/SelectionContext";
import { HoverProvider } from "./state/HoverContext";
import { CameraRigProvider } from "./scene/CameraRigContext";

/** Dependency wiring: data source → snapshot feed → selection → hover → camera rig. */
export function AppProviders({ source, children }: { source: AgentSource; children: ReactNode }) {
  return (
    <AgentSourceProvider source={source}>
      <SnapshotProvider>
        <SelectionProvider>
          <HoverProvider>
            <CameraRigProvider>{children}</CameraRigProvider>
          </HoverProvider>
        </SelectionProvider>
      </SnapshotProvider>
    </AgentSourceProvider>
  );
}
