import type { AgentSession } from "../../domain/types";
import type { CommandAction } from "../../composables/useCommandActions";

/** One row in the palette: a live agent or an app action. */
export type PaletteOptionModel =
  | { key: string; kind: "agent"; session: AgentSession }
  | { key: string; kind: "action"; action: CommandAction };
