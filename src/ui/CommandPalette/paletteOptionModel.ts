import type { AgentSession, Task } from "../../domain/types";
import type { CommandAction } from "../../composables/useCommandActions";

/** One row in the palette: a live agent, task, or app action. */
export type PaletteOptionModel =
  | { key: string; kind: "agent"; session: AgentSession }
  | { key: string; kind: "task"; task: Task; projectPath: string }
  | { key: string; kind: "action"; action: CommandAction };
