import { computed, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { Copy, FolderOpen, List, Map as MapIcon, MapPin, RefreshCw, X, type LucideIcon } from "@lucide/vue";
import type { PaletteColor } from "../domain/palette";
import { PROVIDER_ORDER, PROVIDERS } from "../domain/providers";
import type { Searchable } from "../domain/search";
import { useAppViewStore } from "../stores/appView";
import { useCameraRigStore } from "../stores/cameraRig";
import { useSelectionStore } from "../stores/selection";
import { useSnapshotStore } from "../stores/snapshot";
import { CAMERA_COMMANDS } from "../ui/cameraCommands";
import { useAgentSource } from "./useAgentSource";

export interface CommandAction extends Searchable {
  id: string;
  Icon: LucideIcon;
  /** District actions show the provider swatch instead of the icon. */
  color?: PaletteColor;
  /** Right-aligned context, e.g. the selected agent's title. */
  hint?: string;
  run: () => void;
}

export function appViewNavigationActions(
  showCity: () => void,
  showTasks: () => void,
): CommandAction[] {
  return [
    {
      id: "view:city",
      label: "Show Dashboard",
      keywords: ["city", "monitoring", "home", "overview", "dashboard"],
      Icon: MapIcon,
      run: showCity,
    },
    {
      id: "view:tasks",
      label: "Open Tasks",
      keywords: ["task", "workspace", "board", "tasks"],
      Icon: List,
      run: showTasks,
    },
  ];
}

/** Palette actions: app navigation, selected-agent shortcuts, districts, camera, refresh. */
export function useCommandActions(): ComputedRef<CommandAction[]> {
  const appView = useAppViewStore();
  const rig = useCameraRigStore();
  const source = useAgentSource();
  const snapshots = useSnapshotStore();
  const selectionStore = useSelectionStore();
  const { selection, selectedSession } = storeToRefs(selectionStore);

  return computed(() => {
    const actions = appViewNavigationActions(() => appView.showCity(), () => appView.showTasks());
    const selected = selectedSession.value;

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
          run: () => selectionStore.clearSession(),
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
          selectionStore.focusProvider(provider);
          rig.focus(provider); // re-centre even when this district is already focused
        },
      });
    }
    const focused = selection.value.provider;
    if (focused) {
      actions.push({
        id: "whole-city",
        label: "Show the whole city",
        hint: PROVIDERS[focused].label,
        keywords: ["clear", "district", "unfocus", "overview"],
        Icon: MapIcon,
        run: () => selectionStore.focusProvider(null),
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
      run: () => void snapshots.refresh(),
    });
    return actions;
  });
}
