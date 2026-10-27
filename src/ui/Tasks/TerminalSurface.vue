<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { osc52ClipboardText } from "../../domain/terminalClipboard";
import { fullTerminalRefreshRange } from "../../domain/terminalDisplay";
import { shouldOpenTerminalLink } from "../../domain/terminalLinks";
import { normalizeAlternateBufferWheelDelta } from "../../domain/terminalWheel";
import { writeClipboardText } from "../../services/clipboard";
import { openExternalUrl } from "../../services/links";

const props = defineProps<{
  label: string;
  active: boolean;
  connected: boolean;
}>();

const emit = defineEmits<{
  data: [value: string];
  resize: [size: { cols: number; rows: number }];
}>();

// The element handed to xterm. FitAddon measures its parent with getComputedStyle().height, which is
// the *border* box, while `.xterm { height: 100% }` resolves against the *content* box: any padding on
// the measured element makes it report rows and columns that don't fit and clip the last line.
const host = useTemplateRef<HTMLDivElement>("host");
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let dataSubscription: { dispose(): void } | null = null;
let resizeSubscription: { dispose(): void } | null = null;
let selectionSubscription: { dispose(): void } | null = null;
let clipboardSubscription: { dispose(): void } | null = null;
let pendingSelection = "";
let initialized = false;
let dispatchingNormalizedWheel = false;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fit(): { cols: number; rows: number } | null {
  const element = host.value;
  if (!element || !terminal || !fitAddon || element.clientWidth === 0 || element.clientHeight === 0) return null;
  fitAddon.fit();
  return { cols: terminal.cols, rows: terminal.rows };
}

function write(data: string | Uint8Array): void {
  terminal?.write(data);
}

function focus(): void {
  terminal?.focus();
}

function refresh(): void {
  if (!terminal) return;
  const range = fullTerminalRefreshRange(terminal.rows);
  if (range) terminal.refresh(...range);
}

function currentSize(): { cols: number; rows: number } | null {
  return terminal ? { cols: terminal.cols, rows: terminal.rows } : null;
}

async function copy(text: string): Promise<void> {
  try {
    await writeClipboardText(text);
  } catch (error) {
    console.error("[argis] could not copy terminal text", error);
  }
}

function commitSelection(): void {
  const text = pendingSelection;
  pendingSelection = "";
  if (text) void copy(text);
}

defineExpose({ fit, write, focus, refresh, currentSize });

function initialize(): void {
  if (initialized) return;
  const element = host.value;
  if (!element || element.clientWidth === 0 || element.clientHeight === 0) return;
  initialized = true;

  terminal = new Terminal({
    cursorBlink: props.connected && props.active,
    disableStdin: !props.connected || !props.active,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    letterSpacing: 0,
    scrollback: 5_000,
    theme: {
      background: token("--bg"),
      foreground: token("--text"),
      cursor: token("--teal"),
    },
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(
    new WebLinksAddon((event, uri) => {
      if (shouldOpenTerminalLink(event)) openExternalUrl(uri);
    }),
  );
  terminal.open(element);
  terminal.attachCustomWheelEventHandler((event) => {
    if (dispatchingNormalizedWheel || !event.target) return true;

    const deltaY = normalizeAlternateBufferWheelDelta(
      event.deltaY,
      event.deltaMode,
      terminal?.buffer.active.type ?? "normal",
    );
    if (deltaY === null) return true;

    dispatchingNormalizedWheel = true;
    try {
      event.target.dispatchEvent(
        new WheelEvent(event.type, {
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          composed: event.composed,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          deltaX: event.deltaX,
          deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
        }),
      );
    } finally {
      dispatchingNormalizedWheel = false;
    }
    return false;
  });

  dataSubscription = terminal.onData((value) => {
    if (props.connected && props.active) emit("data", value);
  });
  resizeSubscription = terminal.onResize(({ cols, rows }) => {
    if (props.connected) emit("resize", { cols, rows });
  });
  selectionSubscription = terminal.onSelectionChange(() => {
    pendingSelection = terminal?.getSelection() ?? "";
  });
  clipboardSubscription = terminal.parser.registerOscHandler(52, (payload) => {
    const text = osc52ClipboardText(payload);
    if (text) void copy(text);
    return true;
  });

  resizeObserver = new ResizeObserver(() => {
    fit();
  });
  resizeObserver.observe(element);
  fit();
}

onMounted(() => {
  document.addEventListener("mouseup", commitSelection);
  initialize();
});

watch(
  () => props.active,
  (active) => {
    if (active) {
      void nextTick(() => {
        initialize();
        fit();
      });
    }
  },
  { flush: "post" },
);

watch(
  () => props.connected && props.active,
  (interactive) => {
    if (!terminal) return;
    terminal.options.disableStdin = !interactive;
    terminal.options.cursorBlink = interactive;
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("mouseup", commitSelection);
  resizeObserver?.disconnect();
  dataSubscription?.dispose();
  resizeSubscription?.dispose();
  selectionSubscription?.dispose();
  clipboardSubscription?.dispose();
  pendingSelection = "";
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});
</script>

<template>
  <div class="terminal-surface">
    <div ref="host" class="terminal-host" role="region" :aria-label="props.label" />
  </div>
</template>

<style scoped>
.terminal-surface {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
}

/* Padding-free on purpose (see `host` above): FitAddon measures this box, so padding belongs on
   `.terminal-surface` — otherwise the terminal is sized for a box taller and wider than it gets. */
.terminal-host {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.terminal-host :deep(.xterm) {
  height: 100%;
}
</style>
