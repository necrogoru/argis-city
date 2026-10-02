import type { AgentStatus } from "../../domain/types";
import { formatElapsed } from "../../domain/format";
import { elapsedMs } from "../../domain/session";
import { useNow } from "../../state/useNow";

interface ElapsedProps {
  item: { status: AgentStatus; startedAt: number; updatedAt: number };
}

/** Self-ticking elapsed timer, isolated so only this text re-renders each second. */
export function Elapsed({ item }: ElapsedProps) {
  const now = useNow();
  return <>{formatElapsed(elapsedMs(item, now))}</>;
}
