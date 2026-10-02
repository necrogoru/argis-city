import type { AgentSource } from "./services/agentSource";
import { AppProviders } from "./AppProviders";
import { CityCanvas } from "./scene/CityCanvas";
import { CameraControls } from "./ui/CameraControls";
import { EmptyState } from "./ui/EmptyState";
import { Hero } from "./ui/Hero/Hero";
import { Overlay } from "./ui/Overlay";
import { RightColumn } from "./ui/RightColumn";
import { SubagentStrip } from "./ui/Subagents/SubagentStrip";
import { TopBar } from "./ui/TopBar/TopBar";

/** Composition only: 3D city behind, glass UI overlay in front. */
export default function App({ source }: { source: AgentSource }) {
  return (
    <AppProviders source={source}>
      <CityCanvas />
      <Overlay>
        <TopBar />
        <Hero />
        <CameraControls />
        <EmptyState />
        <RightColumn />
        <SubagentStrip />
      </Overlay>
    </AppProviders>
  );
}
