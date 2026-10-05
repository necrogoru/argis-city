import { useMemo } from "react";
import { Copy, FolderOpen, Map as MapIcon, MapPin, RefreshCw, X, type LucideIcon } from "lucide-react";
import type { PaletteColor } from "../../domain/palette";
import { PROVIDER_ORDER, PROVIDERS } from "../../domain/providers";
import type { Searchable } from "../../domain/search";
import { useCameraRig } from "../../scene/useCameraRig";
import { useAgentSource } from "../../state/AgentSourceContext";
import { useSelectedSession } from "../../state/useSelectedSession";
import { useSelection } from "../../state/SelectionContext";
import { useSnapshot } from "../../state/SnapshotContext";
import { CAMERA_COMMANDS } from "../CameraControls";

export interface CommandAction extends Searchable {
  id: string;
  Icon: LucideIcon;
  /** District actions show the provider swatch instead of the icon. */
  color?: PaletteColor;
  /** Right-aligned context, e.g. the selected agent's title. */
  hint?: string;
  run: () => void;
}

/** Palette actions: selected-agent shortcuts first, then districts, camera, refresh. */
export function useCommandActions(): CommandAction[] {
  const rig = useCameraRig();
  const source = useAgentSource();
  const { refresh } = useSnapshot();
  const { selection, clearSession, focusProvider } = useSelection();
  const selected = useSelectedSession();
  const focused = selection.provider;

  return useMemo(() => {
    const actions: CommandAction[] = [];

    if (selected) {
      const { title, cwd } = selected.session;
      actions.push(
        {
          id: "open-folder",
          label: "Open folder",
          hint: title,
          keywords: ["reveal", "finder", "directory"],
          Icon: FolderOpen,
          run: () => {
            source.openPath(cwd).catch((error: unknown) => console.error("[argis] open_path failed", error));
          },
        },
        {
          id: "copy-path",
          label: "Copy directory path",
          hint: title,
          keywords: ["clipboard", "cwd"],
          Icon: Copy,
          run: () => void navigator.clipboard?.writeText(cwd),
        },
        {
          id: "close-details",
          label: "Close agent details",
          hint: title,
          keywords: ["back", "deselect", "list"],
          Icon: X,
          run: clearSession,
        },
      );
    }

    for (const provider of PROVIDER_ORDER) {
      const meta = PROVIDERS[provider];
      actions.push({
        id: `district:${provider}`,
        label: `Go to ${meta.label} district`,
        keywords: ["district", "tower", "focus", provider],
        Icon: MapPin,
        color: meta.color,
        run: () => {
          focusProvider(provider);
          rig.focus(provider); // re-centre even when this district is already focused
        },
      });
    }
    if (focused) {
      actions.push({
        id: "whole-city",
        label: "Show the whole city",
        hint: PROVIDERS[focused].label,
        keywords: ["clear", "district", "unfocus", "overview"],
        Icon: MapIcon,
        run: () => focusProvider(null),
      });
    }

    for (const { label, Icon, run } of CAMERA_COMMANDS) {
      actions.push({ id: `camera:${label}`, label, keywords: ["camera", "view"], Icon, run: () => run(rig) });
    }

    actions.push({
      id: "refresh",
      label: "Refresh agents now",
      keywords: ["reload", "scan", "sync"],
      Icon: RefreshCw,
      run: () => void refresh(),
    });
    return actions;
  }, [selected, focused, rig, source, refresh, clearSession, focusProvider]);
}
