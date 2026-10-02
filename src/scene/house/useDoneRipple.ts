import { useEffect, useRef, useState } from "react";
import type { AgentStatus } from "../../domain/types";
import { justFinished } from "../../domain/houseVisuals";

/**
 * Increments each time `status` transitions into "done" (never on mount), so a
 * keyed one-shot ripple can replay.
 */
export function useDoneRipple(status: AgentStatus): number {
  const previous = useRef<AgentStatus | null>(null);
  const [ripples, setRipples] = useState(0);

  useEffect(() => {
    if (justFinished(previous.current, status)) setRipples((n) => n + 1);
    previous.current = status;
  }, [status]);

  return ripples;
}
