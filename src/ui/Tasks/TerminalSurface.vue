<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { fullTerminalRefreshRange } from "../../domain/terminalDisplay";
import { normalizeAlternateBufferWheelDelta } from "../../domain/terminalWheel";

const props = defineProps<{
  label: string;
  active: boolean;
  connected: boolean;
}>();

const emit = defineEmits<{
  data: [value: string];
  resize: [size: { cols: number; rows: number }];
}>();

const host = useTemplateRef<HTMLDivElement>("host");
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let dataSubscription: { dispose(): void } | null = null;
let resizeSubscription: { dispose(): void } | null = null;
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

  resizeObserver = new ResizeObserver(() => {
    fit();
  });
  resizeObserver.observe(element);
  fit();
}

onMounted(() => {
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
  resizeObserver?.disconnect();
  dataSubscription?.dispose();
  resizeSubscription?.dispose();
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});
</script>

<template>
  <div ref="host" class="terminal-surface" role="region" :aria-label="props.label" />
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

.terminal-surface :deep(.xterm) {
  height: 100%;
}
</style>
