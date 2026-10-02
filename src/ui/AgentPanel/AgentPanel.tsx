import type { CSSProperties } from "react";
import { cssVar } from "../../domain/palette";
import type { SelectedSession } from "../../domain/session";
import { ContextBar } from "./ContextBar";
import { MetaRows } from "./MetaRows";
import { PanelActions } from "./PanelActions";
import { PanelHeader } from "./PanelHeader";
import { PanelStats } from "./PanelStats";
import { ProgressSection } from "./ProgressSection";
import styles from "./AgentPanel.module.css";

interface AgentPanelProps {
  selected: SelectedSession;
  /** Return to the agent list (chevron). */
  onBack: () => void;
  onClose: () => void;
}

/** Detail panel for the selected house; lives in the right column in place of the list. */
export function AgentPanel({ selected, onBack, onClose }: AgentPanelProps) {
  const { session, houseNumber, meta } = selected;
  const accent = { "--accent": cssVar(meta.color) } as CSSProperties;

  return (
    <aside className={`glass ${styles.panel}`} style={accent} aria-label={`${session.title} details`}>
      <PanelHeader session={session} meta={meta} houseNumber={houseNumber} onBack={onBack} onClose={onClose} />
      <ProgressSection progress={session.progress} currentStep={session.currentStep} />
      <PanelStats session={session} />
      <ContextBar tokens={session.tokens} />
      <MetaRows session={session} />
      <PanelActions cwd={session.cwd} />
    </aside>
  );
}
