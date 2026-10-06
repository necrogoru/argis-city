# Vue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace React with Vue across the Argis frontend as a straight port — identical look, behavior and performance, no React left in the project.

**Architecture:** Vue 3 single-file components (`<script setup lang="ts">`, `<style scoped>`) replace every `.tsx` file one-to-one in the same folders. App state moves from React contexts to Pinia setup stores (`src/stores/`), reusable logic to Composition-API composables (`src/composables/`), and the 3D city from React Three Fiber to TresJS + cientos, with post-processing and connection lines built on the same `postprocessing` / three.js classes the React version used. The React tree stays on disk (unrendered) until the final cleanup task, so the branch builds and tests at every commit.

**Tech Stack:** Vue 3.5, Pinia 3, VueUse 15, @tresjs/core 5.9 + @tresjs/cientos 5.9, three 0.186, postprocessing 6.39, @lucide/vue, Vite 8 + @vitejs/plugin-vue, vue-tsc, Vitest, Tauri 2 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-06-vue-migration-design.md` — read it before starting; this plan argues from it.

## Global Constraints

- Straight port: identical look and behavior. No UI/behavior changes, no new features, no Rust backend or Tauri config changes.
- Components: `.vue` SFCs with `<script setup lang="ts">`; styles: `<style scoped>` holding the old `.module.css` rules verbatim (exceptions are spelled out in the owning task).
- State: Pinia setup stores in `src/stores/`; reusable logic: composables in `src/composables/`; utilities from VueUse; Vue 3.5 built-ins (`useTemplateRef`, `useId`, `defineModel`) where applicable.
- Canvas: `dpr` `[1, 1.5]`, `antialias: false`, `alpha: false`, `depth: false`, PCF shadows (`PCFShadowMap`), background `PALETTE.bg`, fog `[PALETTE.bg, 110, 175]`, orthographic camera `position [60, 60, 60]`, `zoom 22`, `near 0.1`, `far 1000`.
- Post-processing: `EffectComposer({ multisampling: 0, frameBufferType: HalfFloatType })` + `RenderPass` + one `EffectPass(camera, FXAAEffect, BloomEffect)` — FXAA first; Bloom `{ mipmapBlur: true, intensity: 0.9, luminanceThreshold: 0.55, luminanceSmoothing: 0.2, radius: 0.7 }`.
- Frame rate: no limit while the camera moves; 30 fps when the window is focused; 15 fps when unfocused.
- Reactivity: `snapshot` lives in a `shallowRef`; three.js objects, materials, geometries and the camera-controls instance are never reactive; per-frame work mutates three.js objects inside `useLoop().onBeforeRender` and changes no reactive state.
- CSS animations stay opacity/transform-only (`breathe`, `urgent`) — they are copied verbatim.
- Tests: Vitest, `environment: "node"`, `include: ["src/**/*.test.ts"]`; 12 existing test files stay byte-for-byte unchanged; `src/state/hoverStore.test.ts` is replaced by `src/stores/hover.test.ts` (Task 4) and deleted in Task 16.
- Package manager: `pnpm`. Branch: `vue-migration` (already checked out; never commit to `main`).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` after a blank line.

## Review Focus

1. **Backend unreachable at launch** (`getSnapshot` rejects): the error card with Retry shows and the live pill reads "Backend unavailable"; the next snapshot clears the error. Pinned by the snapshot store tests in Task 2.
2. **A selected session disappears, then comes back with the same id**: the panel closes (fading out with its last content) and the selection does not resurrect. Pinned by the selection store test in Task 3 and the RightColumn check in Task 12.
3. **Window loses focus mid-drag**: the camera keeps rendering at display rate until it rests, then the canvas drops to 15 fps — moving wins over focus. Pinned by the `fpsLimitFor` tests in Task 6.
4. **Sessions appear and vanish between snapshots**: houses mount/unmount without errors, their labels leave the label layer, and shared geometries keep rendering for the remaining houses (TresJS must not dispose module-level geometries). Pinned by the mock-data check in Task 8.
5. **⌘K quickly closed and reopened, and Escape inside the palette**: a stale `close` event must not shut the reopened palette, and Escape closes only the palette, leaving the selection intact. Pinned by the palette checks in Task 14.

---

## File Structure

New files (Vue world):

| Path | Responsibility |
|---|---|
| `src/main.ts`, `src/App.vue` | App bootstrap (Pinia, AgentSource provide) and composition |
| `src/stores/snapshot.ts` | Latest snapshot, error, `refresh()`; subscribes to the AgentSource |
| `src/stores/selection.ts` | Selection state + reconciliation + Escape + `selectedSession` |
| `src/stores/hover.ts` | Hovered session id shared by houses and list rows |
| `src/stores/cameraRig.ts` | Imperative camera API (zoom, fit, reset, focus) + `moving` flag |
| `src/composables/useAgentSource.ts` | `agentSourceKey` + typed `inject` |
| `src/composables/useNow.ts` | One shared 1 s clock |
| `src/composables/useModKey.ts` | ⌘/Ctrl shortcut matcher + listener, `MOD_KEY_LABEL/ARIA` |
| `src/composables/useCursor.ts` | Pointer cursor while hovered |
| `src/composables/useLabelLayer.ts` | Provide/inject of the in-scene label layer element |
| `src/composables/useEffectComposer.ts` | Merged FXAA + Bloom pass installed as the TresJS render function |
| `src/composables/useOcclusion.ts` | drei's label occlusion raycast as a reactive boolean |
| `src/composables/usePressClick.ts` | React-Three-Fiber-style click (any duration, ≤ 6 px travel) on top of TresJS pointer events |
| `src/composables/useHouseGlow.ts`, `useHouseMotion.ts`, `useDoneRipple.ts` | Per-house animation logic |
| `src/composables/useCommandActions.ts` | ⌘K action list |
| `src/scene/frameRate.ts` | Pure `fpsLimitFor` policy |
| `src/scene/interaction.ts` | `CLICK_TOLERANCE_PX` |
| `src/scene/house/sparks.ts` | Shared ember parameters + spark texture |
| `src/scene/*.vue`, `src/scene/house/*.vue` | 3D components (incl. new `SegmentLines.vue`, `FlowLine.vue`, `house/GrowIn.vue`) |
| `src/ui/cameraCommands.ts` | Camera commands shared by the buttons and the palette |
| `src/ui/**/*.vue` | DOM components (incl. new `CommandPalette/PaletteBody.vue`, `PaletteSection.vue`, `paletteOption.ts`) |

Deleted in Task 16: every `.tsx` file, `src/state/**` (contexts, React hooks, `hoverStore.ts` + test), `src/scene/cameraRig.ts`, `src/scene/useCameraRig.ts`, `src/scene/house/use*.ts`, `src/ui/CommandPalette/useCommandActions.ts`, and every `*.module.css`.

Unchanged: `src/domain/**`, `src/services/**`, `src/scene/{layout,cityModel,connectionModel,geometries,materials}.ts` and their tests, `src/styles/**`, `src-tauri/**`.

## Porting Rules (apply to every component task)

- `className={styles.foo}` → `class="foo"`; `className={`glass ${styles.foo}`}` → `class="glass foo"`.
- `style={{ "--tint": x } as CSSProperties}` → `:style="{ '--tint': x }"`; numeric pixel sizes need explicit units (`` `${size}px` ``).
- Boolean JSX attributes (`aria-hidden`) → `aria-hidden="true"`; `data-x={bool}` → `:data-x="bool"` (Vue renders `"true"`/`"false"` like React).
- Callback props become emits: `onSelect(id)` → `defineEmits<{ select: [id: string] }>()` and `@select`; `children` → `<slot />`.
- Lucide icons: `import { Name } from "@lucide/vue"` → `<Name :size="16" aria-hidden="true" />`; `strokeWidth` → `:stroke-width`. Icon fields typed with `import type { LucideIcon } from "@lucide/vue"`.
- Where JSX put an icon and text on separate lines (JSX drops that whitespace), write them adjacent in the template (`<Icon … />{{ text }}`) so no space appears.
- Move styles with this shell helper (define it once per shell session):

```bash
# usage: style_from <module.css> <file.vue> — appends the CSS verbatim as a scoped style block
style_from() { { printf '\n<style scoped>\n'; cat "$1"; printf '</style>\n'; } >> "$2"; }
```

- The old `.tsx` / `.module.css` files are NOT deleted until Task 16; nothing imports them from the Vue tree.

---

### Task 1: Toolchain swap and Vue entry point

**Files:**
- Modify: `package.json` (dependencies, `build` script)
- Modify: `vite.config.ts`
- Modify: `tsconfig.json:21` (`include`)
- Modify: `index.html:22` (entry script)
- Create: `src/main.ts`, `src/App.vue`, `src/composables/useAgentSource.ts`

**Interfaces:**
- Produces: `agentSourceKey: InjectionKey<AgentSource>` and `useAgentSource(): AgentSource` from `src/composables/useAgentSource.ts`; the Vue app mounted on `#root` with Pinia installed and the AgentSource provided.

- [ ] **Step 1: Install the Vue toolchain**

Run:
```bash
pnpm add vue pinia @vueuse/core @tresjs/core @tresjs/cientos @lucide/vue postprocessing
pnpm add -D @vitejs/plugin-vue vue-tsc
```
Expected: both commands finish without peer-dependency errors (React packages stay installed until Task 16).

- [ ] **Step 2: Point the build at vue-tsc**

In `package.json`, change the `build` script:
```json
"build": "vue-tsc --noEmit && vite build",
```

- [ ] **Step 3: Swap the Vite plugin**

Replace the plugin import and `plugins` entry in `vite.config.ts` (keep everything else):
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { templateCompilerOptions } from "@tresjs/core";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  // TresJS elements (<TresMesh>, …) are custom elements for the template compiler.
  plugins: [vue({ ...templateCompilerOptions })],
```
(The rest of the file — `clearScreen`, `server`, `build`, `test` — is unchanged.)

- [ ] **Step 4: Let TypeScript see `.vue` files**

In `tsconfig.json`, change `"include": ["src"]` to:
```json
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
```

- [ ] **Step 5: Create the AgentSource injection key**

Create `src/composables/useAgentSource.ts`:
```ts
import { inject, type InjectionKey } from "vue";
import type { AgentSource } from "../services/agentSource";

/** Provided once in `main.ts`: the Tauri backend in the app, the mock in a browser. */
export const agentSourceKey: InjectionKey<AgentSource> = Symbol("agentSource");

export function useAgentSource(): AgentSource {
  const source = inject(agentSourceKey);
  if (!source) throw new Error("useAgentSource: no AgentSource provided (see main.ts)");
  return source;
}
```

- [ ] **Step 6: Create the Vue entry and a placeholder App**

Create `src/main.ts`:
```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { agentSourceKey } from "./composables/useAgentSource";
import { createAgentSource } from "./services/createAgentSource";
import "./styles/tokens.css";
import "./styles/base.css";

createApp(App).use(createPinia()).provide(agentSourceKey, createAgentSource()).mount("#root");
```

Create `src/App.vue`:
```vue
<script setup lang="ts"></script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <div />
</template>
```

In `index.html`, change the entry script:
```html
    <script type="module" src="/src/main.ts"></script>
```
(Keep `<div id="root"></div>` — `styles/base.css` targets `#root`.)

- [ ] **Step 7: Verify the build and the existing tests**

Run: `pnpm build`
Expected: `vue-tsc` reports no errors and Vite prints `✓ built`.

Run: `pnpm vitest run`
Expected: `Test Files  13 passed (13)`, `Tests  102 passed (102)`.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig.json index.html src/main.ts src/App.vue src/composables/useAgentSource.ts
git commit -m "build: switch the frontend entry to Vue

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Snapshot store

**Files:**
- Create: `src/stores/snapshot.ts`
- Test: `src/stores/snapshot.test.ts`

**Interfaces:**
- Consumes: `useAgentSource()` (Task 1); `AgentSource` from `src/services/agentSource.ts`.
- Produces: `useSnapshotStore()` with state `snapshot: Snapshot | null` (shallow), `error: string | null`, action `refresh(): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `src/stores/snapshot.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "../domain/types";
import { snapshot } from "../domain/testFixtures";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useSnapshotStore } from "./snapshot";

const at = (generatedAt: number): Snapshot => ({ ...snapshot([]), generatedAt });

/** AgentSource whose initial fetch and pushes the test controls. */
function fakeSource(refresh: () => Promise<Snapshot> = async () => at(99)) {
  let resolveInitial!: (s: Snapshot) => void;
  let rejectInitial!: (e: unknown) => void;
  let push: (s: Snapshot) => void = () => {};
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: () => new Promise<Snapshot>((res, rej) => ((resolveInitial = res), (rejectInitial = rej))),
    refresh: vi.fn(refresh),
    subscribe: (callback) => ((push = callback), () => {}),
    openPath: async () => {},
  };
  return { source, resolveInitial: (s: Snapshot) => resolveInitial(s), rejectInitial: (e: unknown) => rejectInitial(e), push: (s: Snapshot) => push(s) };
}

function storeWith(source: AgentSource) {
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  return app.runWithContext(() => useSnapshotStore());
}

describe("useSnapshotStore", () => {
  it("accepts pushed snapshots", () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.push(at(10));
    expect(store.snapshot?.generatedAt).toBe(10);
  });

  it("never lets a late initial fetch overwrite a newer pushed snapshot", async () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.push(at(20));
    fake.resolveInitial(at(10));
    await Promise.resolve();
    expect(store.snapshot?.generatedAt).toBe(20);
  });

  it("records a failed initial fetch, and the next snapshot clears it", async () => {
    const fake = fakeSource();
    const store = storeWith(fake.source);
    fake.rejectInitial(new Error("backend down"));
    await Promise.resolve();
    await Promise.resolve();
    expect(store.error).toBe("backend down");
    expect(store.snapshot).toBeNull();
    fake.push(at(30));
    expect(store.error).toBeNull();
  });

  it("refresh() accepts the fresh snapshot, or records its error", async () => {
    const ok = storeWith(fakeSource().source);
    await ok.refresh();
    expect(ok.snapshot?.generatedAt).toBe(99);

    const failing = storeWith(fakeSource(() => Promise.reject("nope")).source);
    await failing.refresh();
    expect(failing.error).toBe("nope");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/stores/snapshot.test.ts`
Expected: FAIL — `Failed to resolve import "./snapshot"`.

- [ ] **Step 3: Implement the store**

Create `src/stores/snapshot.ts`:
```ts
import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type { Snapshot } from "../domain/types";
import { useAgentSource } from "../composables/useAgentSource";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Latest snapshot (null until the first one arrives), last error, and refresh.
 * The snapshot is replaced whole every poll, so it is a shallowRef: never
 * deep-proxied.
 */
export const useSnapshotStore = defineStore("snapshot", () => {
  const source = useAgentSource();
  const snapshot = shallowRef<Snapshot | null>(null);
  const error = ref<string | null>(null);

  /** Never let a late initial fetch overwrite a newer pushed snapshot. */
  function accept(next: Snapshot): void {
    if (snapshot.value && snapshot.value.generatedAt > next.generatedAt) return;
    snapshot.value = next;
    error.value = null;
  }

  source.subscribe(accept);
  source.getSnapshot().then(accept, (e: unknown) => {
    error.value = errorMessage(e);
  });

  /** Force the backend to collect now. */
  async function refresh(): Promise<void> {
    try {
      accept(await source.refresh());
    } catch (e) {
      error.value = errorMessage(e);
    }
  }

  return { snapshot, error, refresh };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/stores/snapshot.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/snapshot.ts src/stores/snapshot.test.ts
git commit -m "feat(vue): snapshot Pinia store

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Selection store

**Files:**
- Create: `src/stores/selection.ts`
- Test: `src/stores/selection.test.ts`

**Interfaces:**
- Consumes: `useSnapshotStore()` (Task 2); `domain/selection.ts` (`EMPTY_SELECTION`, `reconcileSelection`, `withSession`, `withProvider`, `toggleProvider`, `escapeSelection`, type `Selection`); `findSelected` / `SelectedSession` from `domain/session.ts`.
- Produces: `useSelectionStore()` with getters `selection: Selection`, `selectedSession: SelectedSession | null`; actions `selectSession(id: string | null)`, `clearSession()`, `focusProvider(provider: ProviderId | null)`, `toggleProvider(provider: ProviderId)`, `escape()`.

- [ ] **Step 1: Write the failing tests**

Create `src/stores/selection.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "../domain/types";
import { session, snapshot } from "../domain/testFixtures";
import type { AgentSource } from "../services/agentSource";
import { agentSourceKey } from "../composables/useAgentSource";
import { useSelectionStore } from "./selection";

function setup() {
  let push: (s: Snapshot) => void = () => {};
  const source: AgentSource = {
    kind: "demo",
    getSnapshot: () => new Promise<Snapshot>(() => {}),
    refresh: async () => snapshot([]),
    subscribe: (callback) => ((push = callback), () => {}),
    openPath: async () => {},
  };
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia).provide(agentSourceKey, source);
  setActivePinia(pinia);
  const store = app.runWithContext(() => useSelectionStore());
  let tick = 0;
  /** Push a snapshot with a strictly newer generatedAt each time. */
  const show = (...ids: string[]) => push({ ...snapshot(ids.map((id) => session({ id }))), generatedAt: (tick += 1) });
  return { store, show };
}

describe("useSelectionStore", () => {
  it("selects a live session and resolves its house", () => {
    const { store, show } = setup();
    show("claude:a", "claude:b");
    store.selectSession("claude:b");
    expect(store.selection.sessionId).toBe("claude:b");
    expect(store.selectedSession?.houseNumber).toBe(2);
  });

  it("drops a vanished session and never resurrects it when it returns", () => {
    const { store, show } = setup();
    show("claude:a");
    store.selectSession("claude:a");
    show();
    expect(store.selection.sessionId).toBeNull();
    show("claude:a");
    expect(store.selection.sessionId).toBeNull();
  });

  it("Escape peels the house first, then the district", () => {
    const { store, show } = setup();
    show("claude:a");
    store.focusProvider("claude");
    store.selectSession("claude:a");
    store.escape();
    expect(store.selection).toEqual({ sessionId: null, provider: "claude" });
    store.escape();
    expect(store.selection).toEqual({ sessionId: null, provider: null });
  });

  it("toggling the focused district again clears it", () => {
    const { store } = setup();
    store.toggleProvider("codex");
    expect(store.selection.provider).toBe("codex");
    store.toggleProvider("codex");
    expect(store.selection.provider).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/stores/selection.test.ts`
Expected: FAIL — `Failed to resolve import "./selection"`.

- [ ] **Step 3: Implement the store**

Create `src/stores/selection.ts`:
```ts
import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import type { ProviderId } from "../domain/types";
import {
  EMPTY_SELECTION,
  escapeSelection,
  reconcileSelection,
  toggleProvider as toggled,
  withProvider,
  withSession,
  type Selection,
} from "../domain/selection";
import { findSelected } from "../domain/session";
import { useSnapshotStore } from "./snapshot";

/** What the user is looking at — one house and/or one focused district. */
export const useSelectionStore = defineStore("selection", () => {
  const snapshots = useSnapshotStore();
  const raw = shallowRef<Selection>(EMPTY_SELECTION);
  const selection = computed(() =>
    snapshots.snapshot ? reconcileSelection(raw.value, snapshots.snapshot) : raw.value,
  );
  // Persist the reconciliation so a vanished session never silently comes back.
  watch(
    selection,
    (next) => {
      if (next !== raw.value) raw.value = next;
    },
    { flush: "sync" },
  );
  const selectedSession = computed(() => findSelected(snapshots.snapshot, selection.value.sessionId));

  function selectSession(sessionId: string | null): void {
    raw.value = withSession(selection.value, sessionId);
  }
  function clearSession(): void {
    raw.value = withSession(selection.value, null);
  }
  function focusProvider(provider: ProviderId | null): void {
    raw.value = withProvider(selection.value, provider);
  }
  function toggleProvider(provider: ProviderId): void {
    raw.value = toggled(selection.value, provider);
  }
  /** Escape peels one layer: first the house, then the district focus. */
  function escape(): void {
    raw.value = escapeSelection(selection.value);
  }

  // The ⌘K palette preventDefault()s its own Escape, so it never reaches here.
  onKeyStroke("Escape", (event) => {
    if (!event.defaultPrevented) escape();
  });

  return { selection, selectedSession, selectSession, clearSession, focusProvider, toggleProvider, escape };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/stores/selection.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/selection.ts src/stores/selection.test.ts
git commit -m "feat(vue): selection Pinia store

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Hover store

**Files:**
- Create: `src/stores/hover.ts`
- Test: `src/stores/hover.test.ts` (ports the cases of `src/state/hoverStore.test.ts`)

**Interfaces:**
- Produces: `useHoverStore()` with state `hoveredId: string | null`; actions `set(id: string | null)`, `clear(id: string)`.

- [ ] **Step 1: Write the failing tests**

Create `src/stores/hover.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { watch } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useHoverStore } from "./hover";

describe("useHoverStore", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sets, notifies once per change and ignores repeats", () => {
    const store = useHoverStore();
    const listener = vi.fn();
    watch(() => store.hoveredId, listener, { flush: "sync" });
    store.set("claude:a");
    store.set("claude:a");
    expect(store.hoveredId).toBe("claude:a");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clear only removes the id that is still hovered", () => {
    const store = useHoverStore();
    store.set("b");
    store.clear("a"); // stale leave from a previous target
    expect(store.hoveredId).toBe("b");
    store.clear("b");
    expect(store.hoveredId).toBeNull();
  });

  it("a consumer of one id only reacts when that id's state flips", () => {
    const store = useHoverStore();
    const listener = vi.fn();
    watch(() => store.hoveredId === "a", listener, { flush: "sync" });
    store.set("b");
    store.set("c");
    expect(listener).not.toHaveBeenCalled();
    store.set("a");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/stores/hover.test.ts`
Expected: FAIL — `Failed to resolve import "./hover"`.

- [ ] **Step 3: Implement the store**

Create `src/stores/hover.ts`:
```ts
import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Which session is hovered — shared by the 3D houses and the agent list.
 * Consumers derive `hoveredId === id`, so a hover change re-renders only the
 * two components whose answer flips, not the whole city.
 */
export const useHoverStore = defineStore("hover", () => {
  const hoveredId = ref<string | null>(null);

  function set(id: string | null): void {
    hoveredId.value = id;
  }
  /** Clear only if `id` is still the hovered one (avoids leave/enter races). */
  function clear(id: string): void {
    if (hoveredId.value === id) hoveredId.value = null;
  }

  return { hoveredId, set, clear };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/stores/hover.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/hover.ts src/stores/hover.test.ts
git commit -m "feat(vue): hover Pinia store

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Clock and keyboard composables

**Files:**
- Create: `src/composables/useNow.ts`, `src/composables/useModKey.ts`, `src/composables/useCursor.ts`
- Test: `src/composables/useModKey.test.ts`

**Interfaces:**
- Produces: `useNow(): Ref<number>` (shared 1 s epoch-ms clock); `MOD_KEY_LABEL: string`, `MOD_KEY_ARIA: string`, `isModKey(event, key: string, mac?: boolean): boolean`, `useModKey(key: string, handler: () => void): void`; `useCursor(hovered: Readonly<Ref<boolean>>): void`.

- [ ] **Step 1: Write the failing test for the shortcut matcher**

Create `src/composables/useModKey.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isModKey } from "./useModKey";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("isModKey", () => {
  it("matches ⌘+K on macOS and Ctrl+K elsewhere, case-insensitively", () => {
    expect(isModKey(key("k", { metaKey: true }), "k", true)).toBe(true);
    expect(isModKey(key("K", { metaKey: true }), "k", true)).toBe(true);
    expect(isModKey(key("k", { ctrlKey: true }), "k", false)).toBe(true);
  });

  it("rejects the other platform's modifier, Alt/Shift chords and other keys", () => {
    expect(isModKey(key("k", { ctrlKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("k", { metaKey: true, shiftKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("k", { metaKey: true, altKey: true }), "k", true)).toBe(false);
    expect(isModKey(key("j", { metaKey: true }), "k", true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/composables/useModKey.test.ts`
Expected: FAIL — `Failed to resolve import "./useModKey"`.

- [ ] **Step 3: Implement the three composables**

Create `src/composables/useModKey.ts`:
```ts
import { onKeyStroke } from "@vueuse/core";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘" on macOS, "Ctrl" elsewhere — for shortcut hints. */
export const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl";
/** `aria-keyshortcuts` modifier name matching `MOD_KEY_LABEL`. */
export const MOD_KEY_ARIA = IS_MAC ? "Meta" : "Control";

type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** ⌘+key on macOS / Ctrl+key elsewhere, without Alt or Shift. */
export function isModKey(event: KeyLike, key: string, mac = IS_MAC): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  return mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === key;
}

/** Calls `handler` on ⌘/Ctrl+`key` anywhere in the window (key repeats ignored). */
export function useModKey(key: string, handler: () => void): void {
  onKeyStroke(
    (event) => isModKey(event, key),
    (event) => {
      event.preventDefault();
      if (!event.repeat) handler();
    },
  );
}
```

Create `src/composables/useNow.ts`:
```ts
import { createSharedComposable, useTimestamp } from "@vueuse/core";

/** Current epoch ms, ticking every second — one timer shared by every caller. */
export const useNow = createSharedComposable(() => useTimestamp({ interval: 1_000 }));
```

Create `src/composables/useCursor.ts`:
```ts
import { onBeforeUnmount, watch, type Ref } from "vue";

/** Pointer cursor while `hovered`; back to `auto` on leave or unmount. */
export function useCursor(hovered: Readonly<Ref<boolean>>): void {
  watch(hovered, (on) => {
    document.body.style.cursor = on ? "pointer" : "auto";
  });
  onBeforeUnmount(() => {
    if (hovered.value) document.body.style.cursor = "auto";
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/composables/useModKey.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useNow.ts src/composables/useModKey.ts src/composables/useModKey.test.ts src/composables/useCursor.ts
git commit -m "feat(vue): clock, shortcut and cursor composables

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
## Measurement Kit (used by Tasks 6–17)

macOS stops rendering a WKWebView whose window is fully covered, so every screenshot and CPU measurement uses an **always-on-top test build** of the debug binary in a scratch target directory (the user's `src-tauri/target` is never touched). **Tell the user before each batch** — the test window pops over their screen for ~30 s at a time.

```bash
S=/path/to/scratchpad   # a temp directory outside the repo
```

Helpers already in `$S`: `measure-valid.sh <label>` (launches the test binary, keeps sampling until the window stayed frontmost for the whole run, prints average CPU % and memory for `ui-host`, `gpu`, `webcontent` plus the WebContent footprint), `shot.sh <label>` (screenshot → `$S/shot-<label>.png`), `winid <pid>`, `zorder <pid>`, `front`.

One-time build of the test binary (only needed if `$S/target/debug/argis` is missing; ~1–3 min):
```bash
cd src-tauri && TAURI_CONFIG='{"identifier":"com.necrogoru.argis.perftest","app":{"windows":[{"title":"Argis perf test","x":36,"y":45,"width":1440,"height":900,"minWidth":1180,"minHeight":760,"backgroundColor":"#0A0B0C","alwaysOnTop":true}]}}' CARGO_TARGET_DIR=$S/target cargo build; cd ..
```

The binary loads `http://localhost:1420`. Serve the frontend there first (port must be free: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1420/` prints `000`; if not, the user's `tauri dev` is running — ask them to stop it):
- dev: `pnpm dev > $S/vite.log 2>&1 &` (Vite forwards browser `console.*` into `$S/vite.log`)
- production: `pnpm vite build && npx vite preview --port 1420 --strictPort > $S/preview.log 2>&1 &`

Stop the server afterwards with `pkill -f "argis/node_modules/.*vite/bin/vite.js"` (matches only this repo's dev/preview server — never the user's other Vite servers). If `measure-valid.sh` prints `gave up`, the user is in a full-screen Space: ask them to switch to a normal desktop for a minute.

**React reference build** for side-by-side checks — a worktree of `main` outside the repo, installed once:
```bash
git worktree add $S/argis-main main && (cd $S/argis-main && pnpm install --frozen-lockfile)
```
To screenshot it: stop this repo's server, start `(cd $S/argis-main && pnpm dev > $S/vite-main.log 2>&1 &)`, wait ~5 s, shoot, then `pkill -f "argis-main/node_modules/.*vite/bin/vite.js"` and restart this repo's `pnpm dev`. Task 17 removes the worktree.

**Demo data in the app:** the test binary always runs inside Tauri, so to show the busy mock city temporarily edit line 16 of `src/services/createAgentSource.ts` (in whichever tree is being served) to `if (false && isTauri() && !params.has("mock")) return createTauriAgentSource();`, and revert it with `git checkout src/services/createAgentSource.ts` right after the shot. Never commit that edit.

---

### Task 6: Canvas shell — renderer, camera rig, frame-rate policy, post-processing

**Files:**
- Create: `src/scene/interaction.ts`, `src/scene/frameRate.ts`, `src/scene/frameRate.test.ts`
- Create: `src/composables/usePressClick.ts`, `src/composables/usePressClick.test.ts`
- Create: `src/stores/cameraRig.ts`, `src/composables/useLabelLayer.ts`, `src/composables/useEffectComposer.ts`
- Create: `src/scene/Effects.vue`, `src/scene/Lights.vue`, `src/scene/Ground.vue`, `src/scene/CameraRigBinding.vue`, `src/scene/CityScene.vue`, `src/scene/CityCanvas.vue`
- Create (temporary, deleted in Task 7): `src/scene/FpsProbe.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useSelectionStore` (Tasks 2–3); `buildCity`, `CityModel` (`src/scene/cityModel.ts`); `districtFrame`, `fitZoom`, `MIN_ZOOM`, `MAX_ZOOM`, `Frame`, `Size` (`src/scene/layout.ts`).
- Produces:
  - `CLICK_TOLERANCE_PX = 6` (`src/scene/interaction.ts`)
  - `FOCUSED_FPS = 30`, `BACKGROUND_FPS = 15`, `fpsLimitFor({ moving, focused }): number` (`src/scene/frameRate.ts`)
  - `PressEvent`, `notePress(press)`, `usePressClick(onClick, { stop? }) → { onPointerdown, onPointerup }` (`src/composables/usePressClick.ts`)
  - `useCameraRigStore()` — state `moving: boolean`; actions `attach(controls | null)`, `update(view: Size, city: CityModel)`, `setMoving(boolean)`, `zoomIn()`, `zoomOut()`, `fit(animate = true)`, `reset()`, `focus(provider)`, `focusSession(sessionId)`; type `CameraRigStore`
  - `labelLayerKey`, `useLabelLayer(): Readonly<ShallowRef<HTMLDivElement | null>>`
  - `useEffectComposer(): void`
  - `<CityCanvas />` (renders the whole 3D layer); `<CityScene :city>` (ground only in this task — districts arrive in Task 7)

- [ ] **Step 1: Write the failing tests for the frame-rate policy and the press-click**

Create `src/scene/frameRate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BACKGROUND_FPS, FOCUSED_FPS, fpsLimitFor } from "./frameRate";

describe("fpsLimitFor", () => {
  it("caps ambient animation at 30 fps while the window is focused", () => {
    expect(fpsLimitFor({ moving: false, focused: true })).toBe(FOCUSED_FPS);
    expect(FOCUSED_FPS).toBe(30);
  });

  it("drops to 15 fps when the window is unfocused", () => {
    expect(fpsLimitFor({ moving: false, focused: false })).toBe(BACKGROUND_FPS);
    expect(BACKGROUND_FPS).toBe(15);
  });

  it("is unlimited while the camera moves — moving wins over focus", () => {
    expect(fpsLimitFor({ moving: true, focused: true })).toBe(Infinity);
    expect(fpsLimitFor({ moving: true, focused: false })).toBe(Infinity);
  });
});
```

Create `src/composables/usePressClick.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { notePress, usePressClick } from "./usePressClick";

const at = (clientX: number, clientY: number) => ({ clientX, clientY });
const event = (nativeEvent: { clientX: number; clientY: number }) => ({ nativeEvent, stopPropagation: vi.fn() });

describe("usePressClick", () => {
  it("fires when released within 6 px of the press, however long it was held", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const down = at(100, 100);
    notePress(down);
    press.onPointerdown(event(down));
    press.onPointerup(event(at(104, 103))); // 5 px
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a camera drag beyond the tolerance", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const down = at(100, 100);
    notePress(down);
    press.onPointerdown(event(down));
    press.onPointerup(event(at(105, 105))); // 7.07 px
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores a release whose press started on something else", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const here = at(100, 100);
    notePress(here);
    press.onPointerdown(event(here)); // released elsewhere: no pointerup here
    const elsewhere = at(300, 300);
    notePress(elsewhere); // a later press on another object
    press.onPointerup(event(at(300, 301)));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stops propagation only when asked", () => {
    const press = usePressClick(() => {}, { stop: true });
    const down = event(at(1, 1));
    notePress(down.nativeEvent);
    press.onPointerdown(down);
    expect(down.stopPropagation).toHaveBeenCalled();
    const plain = event(at(1, 1));
    usePressClick(() => {}).onPointerdown(plain);
    expect(plain.stopPropagation).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/scene/frameRate.test.ts src/composables/usePressClick.test.ts`
Expected: FAIL — `Failed to resolve import "./frameRate"` and `"./usePressClick"`.

- [ ] **Step 3: Implement the policy, the click composable and the interaction constant**

Create `src/scene/interaction.ts`:
```ts
/** Pointer travel (px) above which a press is treated as a camera drag, not a click. */
export const CLICK_TOLERANCE_PX = 6;
```

Create `src/scene/frameRate.ts`:
```ts
/** Ambient animation rate (glows, sparks, dashes) while the window is focused. */
export const FOCUSED_FPS = 30;
/** …and while it sits unfocused beside other work, glanced at rather than used. */
export const BACKGROUND_FPS = 15;

/**
 * Frame-rate cap for the city canvas. In WKWebView every presented WebGL frame
 * carries a fixed cost (rendering update, GPU-process handoff, layer-tree
 * commit) regardless of scene size, so the frame rate is what CPU use scales
 * with. Ambient effects read the same at 30 fps (15 in the background); camera
 * moves render uncapped.
 */
export function fpsLimitFor({ moving, focused }: { moving: boolean; focused: boolean }): number {
  if (moving) return Infinity;
  return focused ? FOCUSED_FPS : BACKGROUND_FPS;
}
```

Create `src/composables/usePressClick.ts`:
```ts
import { CLICK_TOLERANCE_PX } from "../scene/interaction";

type ScreenPoint = Pick<MouseEvent, "clientX" | "clientY">;

/** The parts of a TresJS pointer event this composable reads. */
export interface PressEvent {
  nativeEvent: ScreenPoint;
  stopPropagation(): void;
}

/**
 * The latest DOM press anywhere in the window. TresJS (via @pmndrs/pointer-events)
 * delivers 3D pointer events batched on the next frame, so a press is matched
 * to its release by the identity of the native event.
 */
let latestPress: ScreenPoint | null = null;
let listening = false;

/** Record a window-level press (called by the capture listener; exported for tests). */
export function notePress(press: ScreenPoint): void {
  latestPress = press;
}

/**
 * React-Three-Fiber-style click on top of TresJS pointer events: fires on
 * pointer-up over the object that was pressed, whatever the press duration,
 * unless the pointer travelled more than CLICK_TOLERANCE_PX (a camera drag).
 * TresJS's own `click` only fires within 300 ms and has no travel distance.
 */
export function usePressClick(onClick: (event: PressEvent) => void, { stop = false } = {}) {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("pointerdown", notePress, { capture: true, passive: true });
  }
  let pressed: ScreenPoint | null = null;

  return {
    onPointerdown(event: PressEvent): void {
      if (stop) event.stopPropagation();
      pressed = event.nativeEvent;
    },
    onPointerup(event: PressEvent): void {
      if (stop) event.stopPropagation();
      const press = pressed;
      pressed = null;
      // Only the press that started on this object, and only if it wasn't a drag.
      if (!press || press !== latestPress) return;
      const travel = Math.hypot(event.nativeEvent.clientX - press.clientX, event.nativeEvent.clientY - press.clientY);
      if (travel <= CLICK_TOLERANCE_PX) onClick(event);
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/scene/frameRate.test.ts src/composables/usePressClick.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Create the camera-rig store**

Create `src/stores/cameraRig.ts`:
```ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { OrthographicCamera } from "three";
import type { BaseCameraControls } from "@tresjs/cientos";
import type { ProviderId } from "../domain/types";
import type { CityModel } from "../scene/cityModel";
import { districtFrame, fitZoom, type Frame, type Size } from "../scene/layout";

/** Camera position relative to its target: classic isometric (azimuth 45°). */
const ISO_OFFSET = 60;
const ZOOM_STEP = 1.3;
/** Aim a little above the lot so the house, its beacon and label sit centred. */
const HOUSE_TARGET_Y = 1.1;

/** Room the overlay takes (hero on the left, panel on the right, bars top/bottom). */
function overlayInsets(view: Size): Size {
  return { width: Math.min(780, view.width * 0.5), height: Math.min(290, view.height * 0.34) };
}

/**
 * Imperative camera API shared by the in-canvas controls and the DOM buttons.
 * The controls instance, view size and city are plain closure state, never
 * reactive: three.js objects must not be wrapped in Vue proxies.
 */
export const useCameraRigStore = defineStore("cameraRig", () => {
  let controls: BaseCameraControls | null = null;
  let view: Size = { width: 1440, height: 900 };
  let city: CityModel | null = null;
  /** True while the camera is dragged, damped or animated — lifts the frame-rate cap. */
  const moving = ref(false);

  function attach(next: BaseCameraControls | null): void {
    controls = next;
  }
  function update(nextView: Size, nextCity: CityModel): void {
    view = nextView;
    city = nextCity;
  }
  function setMoving(value: boolean): void {
    moving.value = value;
  }

  function zoomFor(frame: Frame): number {
    return fitZoom(view, frame, overlayInsets(view));
  }
  function frameAt(x: number, z: number, frame: Frame, animate: boolean): void {
    if (!controls) return;
    void controls.moveTo(x, frame.targetY, z, animate);
    void controls.zoomTo(zoomFor(frame), animate);
  }
  function zoomBy(factor: number): void {
    if (!controls) return;
    const zoom = (controls.camera as OrthographicCamera).zoom;
    void controls.zoomTo(zoom * factor, true);
  }

  function zoomIn(): void {
    zoomBy(ZOOM_STEP);
  }
  function zoomOut(): void {
    zoomBy(1 / ZOOM_STEP);
  }
  /** Frame the whole city, keeping the current rotation. */
  function fit(animate = true): void {
    if (!city) return;
    frameAt(0, 0, city.frame, animate);
  }
  /** Back to the default isometric angle, framing the whole city. */
  function reset(): void {
    if (!controls || !city) return;
    const y = city.frame.targetY;
    void controls.setLookAt(ISO_OFFSET, y + ISO_OFFSET, ISO_OFFSET, 0, y, 0, true);
    void controls.zoomTo(zoomFor(city.frame), true);
  }
  /** Centre and zoom onto one provider's district. */
  function focus(provider: ProviderId): void {
    const district = city?.districts.find((d) => d.provider === provider);
    if (!district) return;
    frameAt(district.x, district.z, districtFrame(district.radius, district.height), true);
  }
  /** Centre on one session's house at district zoom (agent list row click). */
  function focusSession(sessionId: string): void {
    for (const d of city?.districts ?? []) {
      const house = d.houses.find((h) => h.session.id === sessionId);
      if (!house) continue;
      const frame = districtFrame(d.radius, d.height);
      frameAt(d.x + house.x, d.z + house.z, { ...frame, targetY: HOUSE_TARGET_Y }, true);
      return;
    }
  }

  return { moving, attach, update, setMoving, zoomIn, zoomOut, fit, reset, focus, focusSession };
});

export type CameraRigStore = ReturnType<typeof useCameraRigStore>;
```

- [ ] **Step 6: Create the label-layer and effect-composer composables**

Create `src/composables/useLabelLayer.ts`:
```ts
import { inject, type InjectionKey, type ShallowRef } from "vue";

type LabelLayer = Readonly<ShallowRef<HTMLDivElement | null>>;

/**
 * DOM layer (above the canvas, below the UI overlay) hosting every in-scene
 * label. A stable portal target matters: labels rendered into a node that
 * appears later re-mount and can race the previous render, so CityCanvas owns
 * one element for the whole session and labels wait until it exists.
 */
export const labelLayerKey: InjectionKey<LabelLayer> = Symbol("labelLayer");

export function useLabelLayer(): LabelLayer {
  const layer = inject(labelLayerKey);
  if (!layer) throw new Error("useLabelLayer must be used inside <CityCanvas>");
  return layer;
}
```

Create `src/composables/useEffectComposer.ts`:
```ts
import { onUnmounted, watch } from "vue";
import { useLoop, useTres } from "@tresjs/core";
import { HalfFloatType, type WebGLRenderer } from "three";
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass } from "postprocessing";

/**
 * Neon glow: only HDR emissives (toneMapped=false, intensity > 1) cross the
 * luminance threshold, so the matte city stays crisp.
 */
const BLOOM = { mipmapBlur: true, intensity: 0.9, luminanceThreshold: 0.55, luminanceSmoothing: 0.2, radius: 0.7 };

/**
 * Replaces the TresJS render function with one EffectComposer: RenderPass, then
 * a single EffectPass merging FXAA and Bloom (FXAA first — it resamples the
 * input and replaces the colour). FXAA instead of MSAA: the 4× MSAA half-float
 * buffer measured ~230 MB of GPU memory in a 1440×900 Retina window; FXAA adds
 * none.
 */
export function useEffectComposer(): void {
  const { renderer, scene, camera, sizes } = useTres();
  const composer = new EffectComposer(renderer as WebGLRenderer, {
    multisampling: 0,
    frameBufferType: HalfFloatType,
  });
  const fxaa = new FXAAEffect();
  const bloom = new BloomEffect(BLOOM);

  watch(
    camera,
    (active) => {
      composer.removeAllPasses();
      if (!active) return;
      composer.addPass(new RenderPass(scene.value, active));
      composer.addPass(new EffectPass(active, fxaa, bloom));
    },
    { immediate: true },
  );
  watch([sizes.width, sizes.height], ([width, height]) => composer.setSize(width, height), { immediate: true });

  useLoop().render((notifySuccess) => {
    composer.render();
    notifySuccess();
  });
  onUnmounted(() => composer.dispose());
}
```

- [ ] **Step 7: Create the scene components**

Create `src/scene/Effects.vue`:
```vue
<script setup lang="ts">
import { useEffectComposer } from "../composables/useEffectComposer";

useEffectComposer();
</script>

<!-- FXAA + Bloom post-processing; renders nothing itself. -->
<template>
  <slot />
</template>
```

Create `src/scene/Lights.vue`:
```vue
<script setup lang="ts">
const SHADOW_EXTENT = 26;
</script>

<!-- Low ambient fill + one cool key light casting soft shadows across the city. -->
<template>
  <TresAmbientLight :intensity="0.35" />
  <TresHemisphereLight :args="['#2A3A3C', '#050606', 0.6]" />
  <TresDirectionalLight
    :position="[-12, 22, 9]"
    :intensity="1.4"
    color="#DCEBFF"
    cast-shadow
    :shadow-mapSize="[2048, 2048]"
    :shadow-bias="-0.0004"
    :shadow-normalBias="0.02"
    :shadow-camera-left="-SHADOW_EXTENT"
    :shadow-camera-right="SHADOW_EXTENT"
    :shadow-camera-top="SHADOW_EXTENT"
    :shadow-camera-bottom="-SHADOW_EXTENT"
    :shadow-camera-near="1"
    :shadow-camera-far="80"
  />
  <!-- Faint teal bounce from the city centre. -->
  <TresDirectionalLight :position="[10, 6, 12]" :intensity="0.25" color="#32F3E2" />
</template>
```

Create `src/scene/Ground.vue`:
```vue
<script setup lang="ts">
import { Grid } from "@tresjs/cientos";
import { usePressClick } from "../composables/usePressClick";

const emit = defineEmits<{ deselect: [] }>();
const press = usePressClick(() => emit("deselect"));
</script>

<!-- Matte black ground with faint street lines; clicking it deselects. -->
<template>
  <TresGroup>
    <TresMesh :rotation-x="-Math.PI / 2" receive-shadow @pointerdown="press.onPointerdown" @pointerup="press.onPointerup">
      <TresPlaneGeometry :args="[400, 400]" />
      <TresMeshStandardMaterial color="#0C0E0F" :roughness="1" :metalness="0" />
    </TresMesh>
    <!-- World-aligned grid reads as diagonal streets through the iso camera. -->
    <Grid
      :position="[0, 0.004, 0]"
      :args="[160, 160]"
      :cell-size="1.75"
      :cell-thickness="0.6"
      cell-color="#121618"
      :section-size="7"
      :section-thickness="1.1"
      section-color="#1B2124"
      :fade-distance="58"
      :fade-strength="1.6"
      :fade-from="0"
      infinite-grid
    />
  </TresGroup>
</template>
```

Create `src/scene/CameraRigBinding.vue`:
```vue
<script setup lang="ts">
import { computed, useTemplateRef, watch } from "vue";
import { useTres } from "@tresjs/core";
import { BaseCameraControls, CameraControls } from "@tresjs/cientos";
import type { ProviderId } from "../domain/types";
import { useCameraRigStore } from "../stores/cameraRig";
import type { CityModel } from "./cityModel";
import { MAX_ZOOM, MIN_ZOOM } from "./layout";

const { ACTION } = BaseCameraControls;
// Map-like: left drag pans, right drag orbits, wheel zooms to the cursor.
const MOUSE = { left: ACTION.TRUCK, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM };
const TOUCH = { one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.NONE };
/** Camera activity events; "moving" clears this long after the last one. */
const ACTIVITY = ["controlstart", "control", "transitionstart", "update", "wake"] as const;
const MOVE_GRACE_MS = 150;

const props = defineProps<{ city: CityModel; hasData: boolean; focusedProvider: ProviderId | null }>();
const rig = useCameraRigStore();
const { sizes } = useTres();
const controlsComponent = useTemplateRef<InstanceType<typeof CameraControls>>("controls");
const controls = computed(() => controlsComponent.value?.instance ?? null);

// Attach the controls to the rig; any camera activity lifts the frame-rate cap
// until MOVE_GRACE_MS after the last event (covers a press that never moves).
watch(
  controls,
  (next, _previous, onCleanup) => {
    rig.attach(next);
    if (!next) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      rig.setMoving(true);
      clearTimeout(idle);
      idle = setTimeout(() => rig.setMoving(false), MOVE_GRACE_MS);
    };
    ACTIVITY.forEach((type) => next.addEventListener(type, bump));
    onCleanup(() => {
      ACTIVITY.forEach((type) => next.removeEventListener(type, bump));
      clearTimeout(idle);
      rig.setMoving(false);
      rig.attach(null);
    });
  },
  { immediate: true },
);

watch(
  () => [sizes.width.value, sizes.height.value, props.city] as const,
  ([width, height, city]) => rig.update({ width, height }, city),
  { immediate: true },
);

// First real data: frame the city without animation (once the controls exist).
let framed = false;
watch(
  [controls, () => props.hasData],
  ([attached, hasData]) => {
    if (!attached || !hasData || framed) return;
    framed = true;
    rig.update({ width: sizes.width.value, height: sizes.height.value }, props.city);
    rig.fit(false);
  },
  { immediate: true },
);

// District focus from the hero list / tower clicks; clearing it re-frames the city.
watch(
  () => props.focusedProvider,
  (provider) => {
    if (!framed) return;
    if (provider) rig.focus(provider);
    else rig.fit();
  },
);
</script>

<!-- In-canvas half of the camera rig: owns CameraControls and reacts to focus. -->
<template>
  <CameraControls
    ref="controls"
    make-default
    :min-zoom="MIN_ZOOM"
    :max-zoom="MAX_ZOOM"
    :min-polar-angle="0.55"
    :max-polar-angle="1.1"
    :smooth-time="0.32"
    dolly-to-cursor
    :mouse-buttons="MOUSE"
    :touches="TOUCH"
  />
</template>
```

Create `src/scene/CityScene.vue` (ground only for now — Task 7 replaces it):
```vue
<script setup lang="ts">
import { useSelectionStore } from "../stores/selection";
import type { CityModel } from "./cityModel";
import Ground from "./Ground.vue";

defineProps<{ city: CityModel }>();
const selection = useSelectionStore();
</script>

<!-- Ground + all four districts, wired to the shared selection state. -->
<template>
  <Ground @deselect="selection.clearSession()" />
</template>
```

Create `src/scene/FpsProbe.vue` (**temporary** spike instrument, deleted in Task 7 Step 9):
```vue
<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import { useCameraRigStore } from "../stores/cameraRig";

// TEMPORARY spike probe: rendered fps on screen + an animated zoom every 3 s.
const el = document.createElement("div");
el.style.cssText = "position:fixed;left:50%;top:12px;z-index:9999;font:600 28px monospace;color:#f0f;background:#000;padding:2px 8px";
document.body.append(el);
let frames = 0;
let since = performance.now();
useLoop().onRender(() => {
  frames += 1;
  const now = performance.now();
  if (now - since < 1000) return;
  el.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
  frames = 0;
  since = now;
});
const rig = useCameraRigStore();
let zoomIn = true;
const timer = setInterval(() => {
  if (zoomIn) rig.zoomIn();
  else rig.zoomOut();
  zoomIn = !zoomIn;
}, 3_000);
onBeforeUnmount(() => {
  clearInterval(timer);
  el.remove();
});
</script>

<template>
  <slot />
</template>
```

Create `src/scene/CityCanvas.vue`:
```vue
<script setup lang="ts">
import { computed, provide, useTemplateRef } from "vue";
import { storeToRefs } from "pinia";
import { useWindowFocus } from "@vueuse/core";
import { TresCanvas } from "@tresjs/core";
import { PCFShadowMap } from "three";
import { PALETTE } from "../domain/palette";
import { labelLayerKey } from "../composables/useLabelLayer";
import { useCameraRigStore } from "../stores/cameraRig";
import { useSelectionStore } from "../stores/selection";
import { useSnapshotStore } from "../stores/snapshot";
import { buildCity } from "./cityModel";
import { fpsLimitFor } from "./frameRate";
import CameraRigBinding from "./CameraRigBinding.vue";
import CityScene from "./CityScene.vue";
import Effects from "./Effects.vue";
import FpsProbe from "./FpsProbe.vue";
import Lights from "./Lights.vue";

const CAMERA_POSITION: [number, number, number] = [60, 60, 60];
/**
 * Capped below Retina 2×: under bloom + FXAA it reads almost the same, and
 * every full-screen buffer (canvas, composer, bloom) shrinks by ~44% — about
 * 100 MB less GPU memory.
 */
const DPR: [number, number] = [1, 1.5];

const { snapshot } = storeToRefs(useSnapshotStore());
const { selection } = storeToRefs(useSelectionStore());
const { moving } = storeToRefs(useCameraRigStore());
const focused = useWindowFocus();
const city = computed(() => buildCity(snapshot.value));
const fpsLimit = computed(() => fpsLimitFor({ moving: moving.value, focused: focused.value }));

const labels = useTemplateRef<HTMLDivElement>("labels");
provide(labelLayerKey, labels);
</script>

<!-- Full-bleed isometric WebGL city behind the UI overlay. -->
<template>
  <div class="layer">
    <!--
      The scene composer replaces TresJS's render, so the canvas only receives the
      final full-screen pass: no depth buffer needed, and an opaque canvas is
      cheaper for the compositor to blend.
    -->
    <TresCanvas
      :dpr="DPR"
      :antialias="false"
      :alpha="false"
      :depth="false"
      shadows
      :shadow-map-type="PCFShadowMap"
      :fps-limit="fpsLimit"
    >
      <TresOrthographicCamera :position="CAMERA_POSITION" :zoom="22" :near="0.1" :far="1000" />
      <TresColor attach="background" :args="[PALETTE.bg]" />
      <TresFog attach="fog" :args="[PALETTE.bg, 110, 175]" />
      <!-- First, so the controls update before the labels project each frame. -->
      <CameraRigBinding :city="city" :has-data="snapshot != null" :focused-provider="selection.provider" />
      <Lights />
      <CityScene :city="city" />
      <Effects />
      <FpsProbe />
    </TresCanvas>
    <div ref="labels" class="labels" />
  </div>
</template>
```
Then append the styles and fix the one stale comment:
```bash
style_from src/scene/CityCanvas.module.css src/scene/CityCanvas.vue
sed -i '' "s|so drei Html's projected coordinates line up|so the Html labels' projected coordinates line up|" src/scene/CityCanvas.vue
```

- [ ] **Step 8: Mount the canvas in the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
</template>
```

- [ ] **Step 9: Type-check, test, and look at it**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; `Test Files  19 passed (19)`.

Using the Measurement Kit (announce the pop-up window to the user first), start `pnpm dev`, then:
```bash
$S/shot.sh t6-ground
```
Read `$S/shot-t6-ground.png`. Expected: the dark ground with the faint diagonal street grid (no houses or towers yet), the magenta fps label at the top, and no error text in `$S/vite.log` (`grep -i "error\|warn" $S/vite.log` shows nothing new besides `THREE.Clock` deprecation notices).

Frame-rate policy (the test window is never focused, so idle = 15 fps):
```bash
$S/target/debug/argis >/dev/null 2>&1 & app=$!; sleep 8
wid=$($S/winid $app | head -1 | cut -d' ' -f1)
for i in 1 2 3 4 5 6 7 8; do screencapture -x -o -l $wid $S/fps-$i.png; sips -c 120 600 --cropOffset 0 1140 $S/fps-$i.png --out $S/fpscrop-$i.png >/dev/null; sleep 0.75; done
kill $app
```
Read the eight `$S/fpscrop-*.png` crops. Expected: readings during the zoom transitions above 30 (display rate, typically 60), and idle readings of 15. If idle never shows 15, `:fps-limit` is not reactive — stop and report.

- [ ] **Step 10: Commit**

```bash
git add src/scene/interaction.ts src/scene/frameRate.ts src/scene/frameRate.test.ts src/composables/usePressClick.ts src/composables/usePressClick.test.ts src/stores/cameraRig.ts src/composables/useLabelLayer.ts src/composables/useEffectComposer.ts src/scene/Effects.vue src/scene/Lights.vue src/scene/Ground.vue src/scene/CameraRigBinding.vue src/scene/CityScene.vue src/scene/CityCanvas.vue src/scene/FpsProbe.vue src/App.vue
git commit -m "feat(vue): TresJS canvas, camera rig, frame-rate policy and post-processing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Towers, districts and houses with labels (risk spike)

**Files:**
- Create: `src/composables/useOcclusion.ts`, `src/composables/useHouseGlow.ts`, `src/composables/useHouseMotion.ts`
- Create: `src/scene/Tower.vue`, `src/scene/TowerLabel.vue`, `src/scene/District.vue`, `src/scene/house/House.vue`, `src/scene/house/HouseShell.vue`, `src/scene/house/HouseLabel.vue`
- Modify: `src/scene/CityScene.vue` (full version)
- Delete: `src/scene/FpsProbe.vue` and its use in `src/scene/CityCanvas.vue` (end of task)

**Interfaces:**
- Consumes: `usePressClick`, `useCursor`, `useLabelLayer`, `useHoverStore`, `useSelectionStore`; `geometries.ts` (`unitBox`, `TOWER`, `HOUSE`, `HOUSE_TOP`, `towerStripGeometry`, `roofPanelGeometry`, `roofGeometry`, `houseKeyWindowGeometry`, `houseRestWindowGeometry`); `materials.ts` (`plinthMaterial`, `towerBodyMaterial`, `towerCrownMaterial`, `lotMaterial`, `GLOW_BASE_COLOR`); `domain/houseVisuals.ts` (`houseVisual`, `housePhase`, `emissiveAt`, `HouseVisual`); `labelLift` (`layout.ts`).
- Produces:
  - `useOcclusion(target, occluders): Readonly<Ref<boolean>>`
  - `useHouseGlow(refs: HouseGlowRefs, visual: () => HouseVisual, phase: () => number, hovered: () => boolean): void`
  - `useHouseMotion(group, x: () => number, z: () => number, lifted: () => boolean): void`
  - `Tower.vue` exposes `body: Mesh | null` (the occluder for its district's labels); emits `focus(meta)`.
  - `House.vue` props `{ id, provider, status, title, percent, index, ring, x, z, selected, occluders: () => readonly (Object3D | null)[] }`, emits `select(id)` (Task 8 extends the template).
  - `District.vue` props `{ district, highlighted, selectedId }`, emits `selectHouse(id)`, `focus(meta)` (Task 8 adds the connection lines).

- [ ] **Step 1: Create the per-house composables and the occlusion test**

Create `src/composables/useOcclusion.ts`:
```ts
import { ref, type Ref, type ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Raycaster, Vector2, Vector3, type Object3D } from "three";

const raycaster = new Raycaster();
const anchor = new Vector3();
const projected = new Vector3();
const ndc = new Vector2();

/**
 * True while one of `occluders` stands between the camera and `target` — the
 * raycast drei's Html used. Labels fade (not hide) while occluded; cientos'
 * Html would hide them, so labels use this instead of its `occlude` prop.
 */
export function useOcclusion(
  target: Readonly<ShallowRef<Object3D | null>>,
  occluders: () => readonly (Object3D | null)[],
): Readonly<Ref<boolean>> {
  const occluded = ref(false);
  useLoop().onBeforeRender(({ camera }) => {
    const cam = camera.value;
    const object = target.value;
    if (!cam || !object) return;
    const targets = occluders().filter((o): o is Object3D => o != null);
    if (targets.length === 0) return;
    cam.updateMatrixWorld();
    object.updateWorldMatrix(true, false);
    anchor.setFromMatrixPosition(object.matrixWorld);
    projected.copy(anchor).project(cam);
    raycaster.setFromCamera(ndc.set(projected.x, projected.y), cam);
    const hit = raycaster.intersectObjects(targets, true)[0];
    const next = hit != null && hit.distance < anchor.distanceTo(raycaster.ray.origin);
    if (next !== occluded.value) occluded.value = next;
  });
  return occluded;
}
```

Create `src/composables/useHouseGlow.ts`:
```ts
import { computed, type ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Color, type MeshStandardMaterial } from "three";
import { emissiveAt, type HouseVisual } from "../domain/houseVisuals";

type MaterialRef = Readonly<ShallowRef<MeshStandardMaterial | null>>;

export interface HouseGlowRefs {
  keyWindows: MaterialRef;
  restWindows: MaterialRef;
  roof: MaterialRef;
  body: MaterialRef;
}

const HOVER_BOOST = 1.35;
const DARK_WINDOW = 0.02;

/**
 * Drives a house's materials every frame from its HouseVisual. Colours ease
 * over ~0.5 s and intensity over ~70 ms, so status changes never snap while
 * blinks and flickers stay crisp.
 */
export function useHouseGlow(
  refs: HouseGlowRefs,
  visual: () => HouseVisual,
  phase: () => number,
  hovered: () => boolean,
): void {
  const target = computed(() => ({ glow: new Color(visual().hex), body: new Color(visual().bodyHex) }));
  let level: number | null = null;
  /** 0 = only the key windows lit (idle), 1 = all windows lit; eased. */
  let litMix: number | null = null;

  useLoop().onBeforeRender(({ delta, elapsed }) => {
    const keyWindows = refs.keyWindows.value;
    const restWindows = refs.restWindows.value;
    const roof = refs.roof.value;
    const body = refs.body.value;
    if (!keyWindows || !restWindows || !roof || !body) return;
    const kColor = 1 - Math.exp(-delta * 4);
    const kLevel = 1 - Math.exp(-delta * 14);
    const current = visual();

    const goal = emissiveAt(current, elapsed, phase()) * (hovered() ? HOVER_BOOST : 1);
    level = level == null ? goal : level + (goal - level) * kLevel;
    const litGoal = current.litWindows === "few" ? 0 : 1;
    litMix = litMix == null ? litGoal : litMix + (litGoal - litMix) * kColor;

    const { glow, body: bodyColor } = target.value;
    keyWindows.emissive.lerp(glow, kColor);
    restWindows.emissive.lerp(glow, kColor);
    roof.emissive.lerp(glow, kColor);
    keyWindows.emissiveIntensity = level;
    restWindows.emissiveIntensity = DARK_WINDOW + (level - DARK_WINDOW) * litMix;
    roof.emissiveIntensity = 0.03 + level * 0.28;
    body.color.lerp(bodyColor, kColor);
  });
}
```

Create `src/composables/useHouseMotion.ts`:
```ts
import type { ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";

const LIFT = 0.16;

/** Eases a house towards its lot (layout changes) and lifts it while hovered/selected. */
export function useHouseMotion(
  group: Readonly<ShallowRef<Group | null>>,
  x: () => number,
  z: () => number,
  lifted: () => boolean,
): void {
  useLoop().onBeforeRender(({ delta }) => {
    const p = group.value?.position;
    if (!p) return;
    const k = 1 - Math.exp(-delta * 7);
    const y = lifted() ? LIFT : 0;
    const tx = x();
    const tz = z();
    p.set(p.x + (tx - p.x) * k, p.y + (y - p.y) * k, p.z + (tz - p.z) * k);
  });
}
```

- [ ] **Step 2: Create the tower and its label**

Create `src/scene/TowerLabel.vue`:
```vue
<script setup lang="ts">
import { Html } from "@tresjs/cientos";
import type { ProviderMeta } from "../domain/providers";
import { useLabelLayer } from "../composables/useLabelLayer";
import type { DistrictState } from "./cityModel";

const NOTES: Readonly<Record<DistrictState, string | null>> = {
  live: null,
  empty: "No live sessions",
  unavailable: "Not installed",
};

defineProps<{
  position: [number, number, number];
  meta: ProviderMeta;
  count: number;
  state: DistrictState;
  highlighted: boolean;
}>();
const emit = defineEmits<{ focus: [meta: ProviderMeta] }>();
const layer = useLabelLayer();
</script>

<!-- In-scene glass pill anchored to the tower top, rendered into the label layer. -->
<template>
  <Html v-if="layer" :position="position" :portal="layer" :z-index-range="[50, 41]">
    <div class="root" :style="{ '--accent': meta.hex }" :data-state="state">
      <button
        type="button"
        class="pill"
        :data-highlighted="highlighted"
        :aria-label="`Focus ${meta.label} district, ${count} live sessions`"
        @click="emit('focus', meta)"
      >
        <span class="swatch" />
        <span class="name">{{ meta.label }}</span>
        <span class="count">{{ count }}</span>
      </button>
      <span v-if="NOTES[state]" class="note">{{ NOTES[state] }}</span>
      <span class="line" />
      <span class="dot" />
    </div>
  </Html>
</template>
```
```bash
style_from src/scene/TowerLabel.module.css src/scene/TowerLabel.vue
```

Create `src/scene/Tower.vue`:
```vue
<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { ProviderMeta } from "../domain/providers";
import { useCursor } from "../composables/useCursor";
import { usePressClick } from "../composables/usePressClick";
import type { DistrictState } from "./cityModel";
import { roofPanelGeometry, TOWER, towerStripGeometry, unitBox } from "./geometries";
import { GLOW_BASE_COLOR, plinthMaterial, towerBodyMaterial, towerCrownMaterial } from "./materials";
import TowerLabel from "./TowerLabel.vue";

const props = defineProps<{
  meta: ProviderMeta;
  height: number;
  count: number;
  state: DistrictState;
  highlighted: boolean;
}>();
const emit = defineEmits<{ focus: [meta: ProviderMeta] }>();

const bodyGroup = useTemplateRef<Group>("bodyGroup");
const top = useTemplateRef<Group>("top");
const strips = useTemplateRef<MeshStandardMaterial>("strips");
const panels = useTemplateRef<MeshStandardMaterial>("panels");
/** Body mesh, used to fade house labels hidden behind the tower. */
const body = useTemplateRef<Mesh>("body");
defineExpose({ body });

// Mount at the right height; afterwards the loop eases every change.
const initialHeight = props.height;
const hovered = ref(false);
useCursor(hovered);
const press = usePressClick(() => emit("focus", props.meta), { stop: true });

useLoop().onBeforeRender(({ delta, elapsed }) => {
  if (!bodyGroup.value || !top.value) return;
  const h = bodyGroup.value.scale.y + (props.height - bodyGroup.value.scale.y) * (1 - Math.exp(-delta * 4));
  bodyGroup.value.scale.y = h;
  top.value.position.y = h;
  const base = props.state === "live" ? 1.6 + 0.2 * Math.sin(elapsed * 1.3) : props.state === "empty" ? 0.22 : 0.08;
  const boost = hovered.value || props.highlighted ? 1.3 : 1;
  if (strips.value) strips.value.emissiveIntensity = base * boost;
  if (panels.value) panels.value.emissiveIntensity = base * 1.4 * boost;
});

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  hovered.value = true;
}
</script>

<!-- Provider tower: matte body, emissive strips and roof panels, eased height. -->
<template>
  <TresGroup
    @pointerdown="press.onPointerdown"
    @pointerup="press.onPointerup"
    @pointerover="onPointerover"
    @pointerout="hovered = false"
  >
    <TresMesh
      :geometry="unitBox"
      :material="plinthMaterial"
      :scale="[TOWER.plinth, 0.12, TOWER.plinth]"
      :position-y="0.06"
      receive-shadow
    />
    <TresGroup ref="bodyGroup" :scale-y="initialHeight">
      <TresMesh
        ref="body"
        :geometry="unitBox"
        :material="towerBodyMaterial"
        :scale="[TOWER.width, 1, TOWER.width]"
        :position-y="0.5"
        cast-shadow
        receive-shadow
      />
      <TresMesh :geometry="towerStripGeometry">
        <TresMeshStandardMaterial ref="strips" :color="GLOW_BASE_COLOR" :emissive="meta.hex" :tone-mapped="false" />
      </TresMesh>
    </TresGroup>
    <TresGroup ref="top" :position-y="initialHeight">
      <TresMesh
        :geometry="unitBox"
        :material="towerCrownMaterial"
        :scale="[TOWER.crown, TOWER.crownHeight, TOWER.crown]"
        :position-y="TOWER.crownHeight / 2"
        cast-shadow
      />
      <TresMesh :geometry="roofPanelGeometry" :position-y="TOWER.crownHeight + 0.02">
        <TresMeshStandardMaterial ref="panels" :color="GLOW_BASE_COLOR" :emissive="meta.hex" :tone-mapped="false" />
      </TresMesh>
      <TowerLabel
        :position="[0, TOWER.crownHeight + 0.1, 0]"
        :meta="meta"
        :count="count"
        :state="state"
        :highlighted="highlighted"
        @focus="emit('focus', $event)"
      />
    </TresGroup>
  </TresGroup>
</template>
```

- [ ] **Step 3: Create the house shell and label**

Create `src/scene/house/HouseShell.vue`:
```vue
<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { MeshStandardMaterial } from "three";
import type { HouseVisual } from "../../domain/houseVisuals";
import { useHouseGlow } from "../../composables/useHouseGlow";
import { HOUSE, houseKeyWindowGeometry, houseRestWindowGeometry, roofGeometry, unitBox } from "../geometries";
import { GLOW_BASE_COLOR, lotMaterial } from "../materials";

const props = defineProps<{ visual: HouseVisual; phase: number; hovered: boolean }>();
// Mount with the right colours (bound once); afterwards useHouseGlow eases every change.
const initial = props.visual;
useHouseGlow(
  {
    keyWindows: useTemplateRef<MeshStandardMaterial>("keyWindows"),
    restWindows: useTemplateRef<MeshStandardMaterial>("restWindows"),
    roof: useTemplateRef<MeshStandardMaterial>("roof"),
    body: useTemplateRef<MeshStandardMaterial>("body"),
  },
  () => props.visual,
  () => props.phase,
  () => props.hovered,
);
</script>

<!-- Lot, matte body, pyramid roof and windows — lit and animated by status. -->
<template>
  <TresMesh
    :geometry="unitBox"
    :material="lotMaterial"
    :scale="[HOUSE.lot, 0.05, HOUSE.lot]"
    :position-y="0.025"
    receive-shadow
  />
  <TresMesh
    :geometry="unitBox"
    :scale="[HOUSE.width, HOUSE.height, HOUSE.width]"
    :position-y="HOUSE.height / 2"
    cast-shadow
    receive-shadow
  >
    <TresMeshStandardMaterial ref="body" :color="initial.bodyHex" :roughness="0.88" :metalness="0.12" />
  </TresMesh>
  <TresMesh :geometry="houseKeyWindowGeometry">
    <TresMeshStandardMaterial ref="keyWindows" :color="GLOW_BASE_COLOR" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
  <TresMesh :geometry="houseRestWindowGeometry">
    <TresMeshStandardMaterial ref="restWindows" :color="GLOW_BASE_COLOR" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
  <TresMesh :geometry="roofGeometry" cast-shadow>
    <TresMeshStandardMaterial ref="roof" color="#202427" :roughness="0.75" :emissive="initial.hex" :tone-mapped="false" />
  </TresMesh>
</template>
```

Create `src/scene/house/HouseLabel.vue`:
```vue
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { Html } from "@tresjs/cientos";
import type { Group, Object3D } from "three";
import type { AgentStatus } from "../../domain/types";
import { truncateLabel } from "../../domain/format";
import { statusHex } from "../../domain/status";
import { useLabelLayer } from "../../composables/useLabelLayer";
import { useOcclusion } from "../../composables/useOcclusion";
import { HOUSE_TOP } from "../geometries";

/** World height above the roof: leaves room for beacons / halos underneath. */
const LABEL_Y = HOUSE_TOP + 0.95;

const props = defineProps<{
  title: string;
  status: AgentStatus;
  /** Resting opacity (dimmer for idle / done). */
  opacity: number;
  hovered: boolean;
  /** Extra px lift to de-collide mirror-image neighbours. */
  lift: number;
  /** Meshes (the district tower) that fade this label while in front of it. */
  occluders: () => readonly (Object3D | null)[];
}>();
const emit = defineEmits<{ select: []; enter: []; leave: [] }>();
const layer = useLabelLayer();
const anchor = useTemplateRef<Group>("anchor");
const occluded = useOcclusion(anchor, () => props.occluders());
const style = computed(() => ({
  "--dot": statusHex(props.status),
  "--lift": `${props.lift}px`,
  "--rest-opacity": props.opacity,
}));
</script>

<!--
  Always-visible name pill above a house. Pointer convenience only (the agent
  list is the keyboard path), so it is hidden from assistive tech.
-->
<template>
  <TresGroup ref="anchor" :position="[0, LABEL_Y, 0]">
    <Html v-if="layer" :portal="layer" :z-index-range="[40, 0]">
      <div
        class="label"
        :style="style"
        :data-status="status"
        :data-hovered="hovered"
        :data-occluded="occluded"
        :title="title"
        aria-hidden="true"
        @click="emit('select')"
        @pointerenter="emit('enter')"
        @pointerleave="emit('leave')"
      >
        <span class="dot" />
        <span class="text">{{ truncateLabel(title) }}</span>
      </div>
    </Html>
  </TresGroup>
</template>
```
```bash
style_from src/scene/house/HouseLabel.module.css src/scene/house/HouseLabel.vue
```

- [ ] **Step 4: Create the house (shell + label for now)**

Create `src/scene/house/House.vue` (Task 8 replaces it with the version that adds beacons, pulses and the selection marker):
```vue
<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import type { Group, Object3D } from "three";
import type { AgentStatus, ProviderId } from "../../domain/types";
import { housePhase, houseVisual } from "../../domain/houseVisuals";
import { useCursor } from "../../composables/useCursor";
import { useHouseMotion } from "../../composables/useHouseMotion";
import { usePressClick } from "../../composables/usePressClick";
import { useHoverStore } from "../../stores/hover";
import { labelLift } from "../layout";
import HouseLabel from "./HouseLabel.vue";
import HouseShell from "./HouseShell.vue";

const props = defineProps<{
  id: string;
  provider: ProviderId;
  status: AgentStatus;
  title: string;
  percent: number | null;
  /** 0-based index and ring within the district (label stagger). */
  index: number;
  ring: number;
  /** Target offset from the tower; the house eases towards it. */
  x: number;
  z: number;
  selected: boolean;
  /** Meshes (the district tower) that can hide this house's label. */
  occluders: () => readonly (Object3D | null)[];
}>();
const emit = defineEmits<{ select: [id: string] }>();

const group = useTemplateRef<Group>("group");
const initial: [number, number, number] = [props.x, 0, props.z];
const pointerOver = ref(false);
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.id);
const visual = computed(() => houseVisual(props.status, props.provider));
const phase = computed(() => housePhase(props.id));
useCursor(pointerOver);
useHouseMotion(group, () => props.x, () => props.z, () => hovered.value || props.selected);

const select = () => emit("select", props.id);
const enter = () => hover.set(props.id);
const leave = () => hover.clear(props.id);
const press = usePressClick(select, { stop: true });

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  pointerOver.value = true;
  enter();
}
function onPointerout() {
  pointerOver.value = false;
  leave();
}
</script>

<!-- One live session: shell + status effects + name label (or marker when selected). -->
<template>
  <TresGroup
    ref="group"
    :position="initial"
    @pointerdown="press.onPointerdown"
    @pointerup="press.onPointerup"
    @pointerover="onPointerover"
    @pointerout="onPointerout"
  >
    <HouseShell :visual="visual" :phase="phase" :hovered="hovered" />
    <HouseLabel
      v-if="!selected"
      :title="title"
      :status="status"
      :opacity="visual.labelOpacity"
      :hovered="hovered"
      :lift="labelLift(index, ring)"
      :occluders="occluders"
      @select="select"
      @enter="enter"
      @leave="leave"
    />
  </TresGroup>
</template>
```

- [ ] **Step 5: Create the district and the full city scene**

Create `src/scene/District.vue` (Task 8 adds the connection lines):
```vue
<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { ProviderMeta } from "../domain/providers";
import { clampPercent } from "../domain/progress";
import type { DistrictModel } from "./cityModel";
import House from "./house/House.vue";
import Tower from "./Tower.vue";

defineProps<{ district: DistrictModel; highlighted: boolean; selectedId: string | null }>();
const emit = defineEmits<{ selectHouse: [id: string]; focus: [meta: ProviderMeta] }>();
const tower = useTemplateRef<InstanceType<typeof Tower>>("tower");
/** The tower body: house labels fade while it stands between them and the camera. */
const occluders = () => [tower.value?.body ?? null];
</script>

<!-- One provider: its tower, the houses around it and the lines joining them. -->
<template>
  <TresGroup :position="[district.x, 0, district.z]">
    <Tower
      ref="tower"
      :meta="district.meta"
      :height="district.height"
      :count="district.houses.length"
      :state="district.state"
      :highlighted="highlighted"
      @focus="emit('focus', $event)"
    />
    <House
      v-for="house in district.houses"
      :key="house.session.id"
      :id="house.session.id"
      :provider="house.session.provider"
      :status="house.session.status"
      :title="house.session.title"
      :percent="clampPercent(house.session.progress.percent)"
      :index="house.number - 1"
      :ring="house.ring"
      :x="house.x"
      :z="house.z"
      :selected="house.session.id === selectedId"
      :occluders="occluders"
      @select="emit('selectHouse', $event)"
    />
  </TresGroup>
</template>
```

Replace `src/scene/CityScene.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import type { ProviderMeta } from "../domain/providers";
import { useSelectionStore } from "../stores/selection";
import type { CityModel } from "./cityModel";
import District from "./District.vue";
import Ground from "./Ground.vue";

const props = defineProps<{ city: CityModel }>();
const selectionStore = useSelectionStore();
const { selection } = storeToRefs(selectionStore);
const selectedProvider = computed(
  () => props.city.districts.find((d) => d.houses.some((h) => h.session.id === selection.value.sessionId))?.provider,
);
const onFocus = (meta: ProviderMeta) => selectionStore.focusProvider(meta.id);
</script>

<!-- Ground + all four districts, wired to the shared selection state. -->
<template>
  <Ground @deselect="selectionStore.clearSession()" />
  <District
    v-for="district in city.districts"
    :key="district.provider"
    :district="district"
    :highlighted="selection.provider === district.provider || selectedProvider === district.provider"
    :selected-id="selection.sessionId"
    @select-house="selectionStore.selectSession($event)"
    @focus="onFocus"
  />
</template>
```

- [ ] **Step 6: Type-check and test**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Spike check — labels and scene parity (risk 2)**

Announce the test window to the user, set up the React reference worktree (Measurement Kit, once), run this repo's dev server, then screenshot both builds:
```bash
$S/shot.sh t7-vue
pkill -f "argis/node_modules/.*vite/bin/vite.js"; (cd $S/argis-main && pnpm dev > $S/vite-main.log 2>&1 &); sleep 5
$S/shot.sh t7-react
pkill -f "argis-main/node_modules/.*vite/bin/vite.js"; pnpm dev > $S/vite.log 2>&1 &
```

Read `$S/shot-t7-vue.png` and `$S/shot-t7-react.png`. Expected, for the 3D layer (the Vue build has no DOM overlay yet): the same four towers with lit strips, the same houses with matching glow and shadows, tower labels and house labels at the same screen positions, and any house label behind its tower faded (not missing). Then compare 300×300 crops around one tower (`sips -c 300 300 --cropOffset <y> <x> …`) — edges should look equally smooth (FXAA) and the glow equally wide (bloom).

- [ ] **Step 8: Spike check — idle cost of the TresJS loop (risk 1) and clicks (risk 3)**

Temporarily set both rates to 1 fps to expose the idle floor:
```bash
sed -i '' 's/^export const FOCUSED_FPS = 30;/export const FOCUSED_FPS = 1;/; s/^export const BACKGROUND_FPS = 15;/export const BACKGROUND_FPS = 1;/' src/scene/frameRate.ts
sed -i '' '/<FpsProbe \/>/d; /import FpsProbe/d' src/scene/CityCanvas.vue
pkill -f "argis/node_modules/.*vite/bin/vite.js"; pnpm vite build && (npx vite preview --port 1420 --strictPort > $S/preview.log 2>&1 &)
$S/measure-valid.sh t7-floor
```
Expected: `webcontent` CPU ≤ 3.5 % (the React build's 1 fps floor was ~2.0 %; this build has no DOM overlay, so it should be at or below that). If it is higher, TresJS's per-vsync rAF loop costs measurable CPU even when frames are skipped: **stop and report the numbers to the user** before continuing.

Restore the rates and the dev server:
```bash
git checkout src/scene/frameRate.ts
pkill -f "argis/node_modules/.*vite/bin/vite.js"; pnpm dev > $S/vite.log 2>&1 &
```

Ask the user to check clicks in the test window (`$S/target/debug/argis &`): (a) press on a house for a full second, then release → it selects (the label turns into nothing yet — the marker arrives in Task 8 — but the house lifts); (b) press on a house, drag ~30 px, release → the camera pans and nothing is selected; (c) click the ground → the house drops back (deselected). All three must behave this way.

- [ ] **Step 9: Remove the spike probe and commit**

`FpsProbe` was already removed from `CityCanvas.vue` in Step 8; delete the file:
```bash
git rm -q src/scene/FpsProbe.vue
grep -rn "FpsProbe" src || echo "probe gone"
pnpm vue-tsc --noEmit
git add -A src/scene src/composables
git commit -m "feat(vue): towers, districts and houses with fading labels

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Expected: `probe gone`, no type errors.

---

### Task 8: Status effects, connection lines and the selection marker

**Files:**
- Create: `src/composables/useDoneRipple.ts`, `src/composables/useDoneRipple.test.ts`
- Create: `src/scene/SegmentLines.vue`, `src/scene/FlowLine.vue`, `src/scene/ConnectionLines.vue`
- Create: `src/scene/house/sparks.ts`, `src/scene/house/RoofSparks.vue`, `src/scene/house/AlertBeacon.vue`, `src/scene/house/DoneHalo.vue`, `src/scene/house/GrowIn.vue`, `src/scene/house/HouseBeacon.vue`, `src/scene/house/GroundPulse.vue`, `src/scene/house/HouseMarker.vue`
- Modify: `src/scene/house/House.vue` (full version), `src/scene/District.vue` (adds lines)

**Interfaces:**
- Consumes: `buildConnections`, `connectionKey`, `LineHouse`, `Point`, `Rgb` (`connectionModel.ts`); `ringPulse`, `justFinished`, `HouseVisual` (`domain/houseVisuals.ts`); `beaconGeometry`, `haloGeometry`, `pulseRingGeometry`, `selectionRingGeometry`, `HOUSE_TOP` (`geometries.ts`); `beaconMaterial`, `haloMaterial`, `selectionRingMaterial` (`materials.ts`).
- Produces: `useDoneRipple(status: () => AgentStatus): Readonly<Ref<number>>`; `SegmentLines.vue` props `{ points: Point[]; vertexColors?: Rgb[]; color?: Color; lineWidth: number; dashed?; dashSize?; gapSize? }`, exposes `material: LineMaterial`.

- [ ] **Step 1: Write the failing test for the done ripple**

Create `src/composables/useDoneRipple.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { AgentStatus } from "../domain/types";
import { useDoneRipple } from "./useDoneRipple";

describe("useDoneRipple", () => {
  it("counts each transition into done, never the initial status", async () => {
    const status = ref<AgentStatus>("done");
    const ripples = useDoneRipple(() => status.value);
    expect(ripples.value).toBe(0);
    status.value = "running";
    await nextTick();
    status.value = "done";
    await nextTick();
    expect(ripples.value).toBe(1);
    status.value = "idle";
    await nextTick();
    expect(ripples.value).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/composables/useDoneRipple.test.ts`
Expected: FAIL — `Failed to resolve import "./useDoneRipple"`.

- [ ] **Step 3: Implement it**

Create `src/composables/useDoneRipple.ts`:
```ts
import { ref, watch, type Ref } from "vue";
import type { AgentStatus } from "../domain/types";
import { justFinished } from "../domain/houseVisuals";

/**
 * Increments each time `status` transitions into "done" (never on mount), so a
 * keyed one-shot ripple can replay.
 */
export function useDoneRipple(status: () => AgentStatus): Readonly<Ref<number>> {
  const ripples = ref(0);
  watch(status, (next, previous) => {
    if (justFinished(previous ?? null, next)) ripples.value += 1;
  });
  return ripples;
}
```

Run: `pnpm vitest run src/composables/useDoneRipple.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 4: Create the connection lines**

Create `src/scene/SegmentLines.vue`:
```vue
<script setup lang="ts">
import { onBeforeUnmount, watch, watchEffect } from "vue";
import { useTres } from "@tresjs/core";
import type { Color } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { Point, Rgb } from "./connectionModel";

const props = withDefaults(
  defineProps<{
    /** Segment pairs: [start, end, start, end, …]. */
    points: Point[];
    /** One colour per point (overrides `color`). */
    vertexColors?: Rgb[];
    color?: Color;
    lineWidth: number;
    dashed?: boolean;
    dashSize?: number;
    gapSize?: number;
  }>(),
  { vertexColors: undefined, color: undefined, dashed: false, dashSize: 1, gapSize: 1 },
);

const { sizes } = useTres();
const material = new LineMaterial({ toneMapped: false });
const line = new LineSegments2(new LineSegmentsGeometry(), material);
defineExpose({ material });

// New geometry only when the points or colours change (not every snapshot).
watch(
  () => [props.points, props.vertexColors] as const,
  ([points, colors]) => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(points.flat());
    if (colors) geometry.setColors(colors.flat());
    line.geometry.dispose();
    line.geometry = geometry;
    line.computeLineDistances();
  },
  { immediate: true },
);

watchEffect(() => {
  material.color.set(props.vertexColors ? 0xffffff : (props.color ?? 0xffffff));
  material.vertexColors = props.vertexColors != null;
  material.linewidth = props.lineWidth;
  material.dashed = props.dashed;
  material.dashSize = props.dashSize;
  material.gapSize = props.gapSize;
  material.resolution.set(sizes.width.value, sizes.height.value);
});

onBeforeUnmount(() => {
  line.geometry.dispose();
  material.dispose();
});
</script>

<!--
  Screen-space segment pairs (three's LineSegments2, as drei's <Line segments>):
  each [start, end] pair is its own segment, so dashes flow start → end.
-->
<template>
  <primitive :object="line" />
</template>
```

Create `src/scene/FlowLine.vue`:
```vue
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Color } from "three";
import type { Point } from "./connectionModel";
import SegmentLines from "./SegmentLines.vue";

const props = defineProps<{ points: Point[]; hex: string }>();
const line = useTemplateRef<InstanceType<typeof SegmentLines>>("line");
const color = computed(() => new Color(props.hex).multiplyScalar(1.8));

useLoop().onBeforeRender(({ delta }) => {
  const material = line.value?.material;
  if (material) material.dashOffset -= delta * 0.9;
});
</script>

<!-- Dashes that stream from running houses towards their tower. -->
<template>
  <SegmentLines ref="line" :points="points" dashed :dash-size="0.22" :gap-size="0.28" :color="color" :line-width="1.6" />
</template>
```

Create `src/scene/ConnectionLines.vue`:
```vue
<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { PROVIDERS } from "../domain/providers";
import type { ProviderId } from "../domain/types";
import { buildConnections, connectionKey, type LineHouse } from "./connectionModel";
import FlowLine from "./FlowLine.vue";
import SegmentLines from "./SegmentLines.vue";

const props = defineProps<{ houses: readonly LineHouse[]; provider: ProviderId }>();
// Keyed on positions + statuses, not on the per-snapshot array identity.
const key = computed(() => `${props.provider}|${connectionKey(props.houses)}`);
const model = shallowRef(buildConnections(props.houses, props.provider));
watch(key, () => {
  model.value = buildConnections(props.houses, props.provider);
});
</script>

<!-- Status-tinted lines from every house lot to its tower (2 draw calls max). -->
<template>
  <template v-if="model.base.length > 0">
    <SegmentLines :points="model.base" :vertex-colors="model.baseColors" :line-width="1.2" />
    <FlowLine v-if="model.flow.length > 0" :points="model.flow" :hex="PROVIDERS[provider].hex" />
  </template>
</template>
```

- [ ] **Step 5: Create the status effects**

Create `src/scene/house/sparks.ts`:
```ts
import { CanvasTexture } from "three";

export const SPARK_COUNT = 7;
export const SPARK_RISE = 0.8;

/** Fixed pseudo-random per-particle parameters, so embers look irregular. */
export const EMBERS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 91.7 + n * 47.3) * 43758.5453;
    return x - Math.floor(x);
  };
  return { offset: r(1), speed: 0.28 + r(2) * 0.3, angle: r(3) * Math.PI * 2, drift: 0.08 + r(4) * 0.2 };
});

let sparkTexture: CanvasTexture | null = null;

/** Soft round dot, created once on first use and shared by every house. */
export function getSparkTexture(): CanvasTexture {
  if (sparkTexture) return sparkTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const gradient = ctx?.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient?.addColorStop(0, "rgba(255,255,255,1)");
  gradient?.addColorStop(1, "rgba(255,255,255,0)");
  if (ctx && gradient) {
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  sparkTexture = new CanvasTexture(canvas);
  return sparkTexture;
}
```

Create `src/scene/house/RoofSparks.vue`:
```vue
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import { AdditiveBlending, Color, type BufferAttribute, type Points } from "three";
import { HOUSE_TOP } from "../geometries";
import { EMBERS, getSparkTexture, SPARK_COUNT, SPARK_RISE } from "./sparks";

const props = defineProps<{ hex: string; phase: number }>();
const points = useTemplateRef<Points>("points");
const base = computed(() => new Color(props.hex).multiplyScalar(2.2));
const positions = new Float32Array(SPARK_COUNT * 3);
const colors = new Float32Array(SPARK_COUNT * 3);
const texture = getSparkTexture();

useLoop().onBeforeRender(({ elapsed }) => {
  const geometry = points.value?.geometry;
  if (!geometry) return;
  const position = geometry.getAttribute("position") as BufferAttribute;
  const color = geometry.getAttribute("color") as BufferAttribute;
  const tint = base.value;
  EMBERS.forEach((ember, i) => {
    const life = (elapsed * ember.speed + ember.offset + props.phase) % 1;
    const angle = ember.angle + elapsed * 0.5;
    const spread = 0.04 + life * ember.drift;
    position.setXYZ(i, Math.cos(angle) * spread, HOUSE_TOP - 0.05 + life * SPARK_RISE, Math.sin(angle) * spread);
    const fade = Math.sin(life * Math.PI); // fade in, then out
    color.setXYZ(i, tint.r * fade, tint.g * fade, tint.b * fade);
  });
  position.needsUpdate = true;
  color.needsUpdate = true;
});
</script>

<!-- "Running": a few light sparks drifting up from the roof apex, fading as they rise. -->
<template>
  <TresPoints ref="points" :frustum-culled="false">
    <TresBufferGeometry>
      <TresBufferAttribute attach="attributes-position" :args="[positions, 3]" />
      <TresBufferAttribute attach="attributes-color" :args="[colors, 3]" />
    </TresBufferGeometry>
    <TresPointsMaterial
      :map="texture"
      :size="6"
      :size-attenuation="false"
      vertex-colors
      transparent
      :depth-write="false"
      :blending="AdditiveBlending"
      :tone-mapped="false"
    />
  </TresPoints>
</template>
```

Create `src/scene/house/AlertBeacon.vue`:
```vue
<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Mesh } from "three";
import { beaconGeometry, HOUSE_TOP } from "../geometries";
import { beaconMaterial } from "../materials";

const HOVER_Y = HOUSE_TOP + 0.5;
const props = defineProps<{ phase: number }>();
const diamond = useTemplateRef<Mesh>("diamond");

useLoop().onBeforeRender(({ elapsed }) => {
  if (!diamond.value) return;
  diamond.value.position.y = HOVER_Y + Math.sin(elapsed * 2.4 + props.phase) * 0.07;
  diamond.value.rotation.y = elapsed * 1.8;
});
</script>

<!-- "Needs you": an amber diamond that bobs and spins above the roof. -->
<template>
  <TresMesh
    ref="diamond"
    :geometry="beaconGeometry"
    :material="beaconMaterial"
    :position-y="HOVER_Y"
    :scale="[1, 1.55, 1]"
  />
</template>
```

Create `src/scene/house/DoneHalo.vue`:
```vue
<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Mesh } from "three";
import { haloGeometry, HOUSE_TOP } from "../geometries";
import { haloMaterial } from "../materials";

const halo = useTemplateRef<Mesh>("halo");

useLoop().onBeforeRender(({ delta }) => {
  if (halo.value) halo.value.rotation.y += delta * 0.6;
});
</script>

<!-- "Done": a flat, segmented blue halo slowly turning above the roof. -->
<template>
  <TresMesh ref="halo" :geometry="haloGeometry" :material="haloMaterial" :position-y="HOUSE_TOP + 0.24" />
</template>
```

Create `src/scene/house/GrowIn.vue`:
```vue
<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";

const GROW_S = 0.35;
const group = useTemplateRef<Group>("group");
let start: number | null = null;

useLoop().onBeforeRender(({ elapsed }) => {
  if (!group.value) return;
  start ??= elapsed;
  const p = Math.min(1, (elapsed - start) / GROW_S);
  group.value.scale.setScalar(1 - Math.pow(1 - p, 3));
});
</script>

<!-- Eases its children from scale 0 → 1 on mount, so beacons never pop in. -->
<template>
  <TresGroup ref="group" :scale="0">
    <slot />
  </TresGroup>
</template>
```

Create `src/scene/house/HouseBeacon.vue`:
```vue
<script setup lang="ts">
import type { HouseVisual } from "../../domain/houseVisuals";
import AlertBeacon from "./AlertBeacon.vue";
import DoneHalo from "./DoneHalo.vue";
import GrowIn from "./GrowIn.vue";
import RoofSparks from "./RoofSparks.vue";

defineProps<{ visual: HouseVisual; phase: number }>();
</script>

<!-- The status-specific effect above a house: sparks, alert diamond or done halo. -->
<template>
  <RoofSparks v-if="visual.beacon === 'sparks'" :hex="visual.hex" :phase="phase" />
  <GrowIn v-else-if="visual.beacon === 'alert'" key="alert">
    <AlertBeacon :phase="phase" />
  </GrowIn>
  <GrowIn v-else-if="visual.beacon === 'halo'" key="halo">
    <DoneHalo />
  </GrowIn>
</template>
```

Create `src/scene/house/GroundPulse.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { useLoop } from "@tresjs/core";
import { Color, type Mesh, type MeshBasicMaterial } from "three";
import { ringPulse } from "../../domain/houseVisuals";
import { pulseRingGeometry } from "../geometries";

const LOOP_PERIOD_S = 1.8;
const ONCE_PERIOD_S = 1;

const props = withDefaults(
  defineProps<{
    hex: string;
    /** Loop forever (needs you) or play once (~1 s ripple when a session finishes). */
    loop?: boolean;
  }>(),
  { loop: false },
);
const color = computed(() => new Color(props.hex).multiplyScalar(1.8));
const count = props.loop ? 2 : 1;
const rings: (Mesh | null)[] = [];
let start: number | null = null;

useLoop().onBeforeRender(({ elapsed }) => {
  start ??= elapsed;
  const t = elapsed - start;
  rings.forEach((mesh, i) => {
    if (!mesh) return;
    const raw = props.loop ? t / LOOP_PERIOD_S + i / count : t / ONCE_PERIOD_S;
    const { scale, opacity } = ringPulse(props.loop ? raw % 1 : raw);
    mesh.visible = props.loop || raw < 1;
    mesh.scale.setScalar(scale);
    (mesh.material as MeshBasicMaterial).opacity = opacity * 0.85;
  });
});

function setRing(index: number, mesh: unknown): void {
  rings[index] = (mesh as Mesh | null) ?? null;
}
</script>

<!-- Expanding, fading ground ring(s) around a house lot. -->
<template>
  <TresMesh
    v-for="i in count"
    :key="i"
    :ref="(mesh) => setRing(i - 1, mesh)"
    :geometry="pulseRingGeometry"
    :position-y="0.05"
    :render-order="2"
  >
    <TresMeshBasicMaterial :color="color" transparent :opacity="0" :tone-mapped="false" :depth-write="false" />
  </TresMesh>
</template>
```

Create `src/scene/house/HouseMarker.vue`:
```vue
<script setup lang="ts">
import { Html } from "@tresjs/cientos";
import { House as HouseIcon } from "@lucide/vue";
import { formatPercent } from "../../domain/format";
import { useLabelLayer } from "../../composables/useLabelLayer";

defineProps<{ position: [number, number, number]; title: string; percent: number | null }>();
const layer = useLabelLayer();
</script>

<!-- Solid teal callout above the selected house: `title · 68%`, line, ring. -->
<template>
  <Html v-if="layer" :position="position" :portal="layer" :z-index-range="[60, 51]">
    <div class="root">
      <div class="callout">
        <span class="tile">
          <HouseIcon :size="14" :stroke-width="2.2" aria-hidden="true" />
        </span>
        <span class="text">
          <span class="title">{{ title }}</span>
          <span v-if="percent != null" class="percent">· {{ formatPercent(percent) }}</span>
        </span>
      </div>
      <span class="line" />
      <span class="ring" />
    </div>
  </Html>
</template>
```
```bash
style_from src/scene/house/HouseMarker.module.css src/scene/house/HouseMarker.vue
```

- [ ] **Step 6: Replace the house with its full version and add the lines to the district**

Replace `src/scene/house/House.vue`:
```vue
<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import type { Group, Object3D } from "three";
import type { AgentStatus, ProviderId } from "../../domain/types";
import { PALETTE } from "../../domain/palette";
import { housePhase, houseVisual } from "../../domain/houseVisuals";
import { useCursor } from "../../composables/useCursor";
import { useDoneRipple } from "../../composables/useDoneRipple";
import { useHouseMotion } from "../../composables/useHouseMotion";
import { usePressClick } from "../../composables/usePressClick";
import { useHoverStore } from "../../stores/hover";
import { HOUSE_TOP, selectionRingGeometry } from "../geometries";
import { labelLift } from "../layout";
import { selectionRingMaterial } from "../materials";
import GroundPulse from "./GroundPulse.vue";
import HouseBeacon from "./HouseBeacon.vue";
import HouseLabel from "./HouseLabel.vue";
import HouseMarker from "./HouseMarker.vue";
import HouseShell from "./HouseShell.vue";

const props = defineProps<{
  id: string;
  provider: ProviderId;
  status: AgentStatus;
  title: string;
  percent: number | null;
  /** 0-based index and ring within the district (label stagger). */
  index: number;
  ring: number;
  /** Target offset from the tower; the house eases towards it. */
  x: number;
  z: number;
  selected: boolean;
  /** Meshes (the district tower) that can hide this house's label. */
  occluders: () => readonly (Object3D | null)[];
}>();
const emit = defineEmits<{ select: [id: string] }>();

const group = useTemplateRef<Group>("group");
const initial: [number, number, number] = [props.x, 0, props.z];
const pointerOver = ref(false);
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.id);
const visual = computed(() => houseVisual(props.status, props.provider));
const phase = computed(() => housePhase(props.id));
const ripples = useDoneRipple(() => props.status);
useCursor(pointerOver);
useHouseMotion(group, () => props.x, () => props.z, () => hovered.value || props.selected);

const select = () => emit("select", props.id);
const enter = () => hover.set(props.id);
const leave = () => hover.clear(props.id);
const press = usePressClick(select, { stop: true });

function onPointerover(event: { stopPropagation(): void }) {
  event.stopPropagation();
  pointerOver.value = true;
  enter();
}
function onPointerout() {
  pointerOver.value = false;
  leave();
}
</script>

<!-- One live session: shell + status effects + name label (or marker when selected). -->
<template>
  <TresGroup
    ref="group"
    :position="initial"
    @pointerdown="press.onPointerdown"
    @pointerup="press.onPointerup"
    @pointerover="onPointerover"
    @pointerout="onPointerout"
  >
    <HouseShell :visual="visual" :phase="phase" :hovered="hovered" />
    <HouseBeacon :visual="visual" :phase="phase" />
    <GroundPulse v-if="visual.groundPulse" :hex="visual.hex" loop />
    <GroundPulse v-if="ripples > 0" :key="ripples" :hex="PALETTE.blue" />
    <template v-if="selected">
      <TresMesh :geometry="selectionRingGeometry" :material="selectionRingMaterial" :position-y="0.06" />
      <HouseMarker :position="[0, HOUSE_TOP + 0.05, 0]" :title="title" :percent="percent" />
    </template>
    <HouseLabel
      v-else
      :title="title"
      :status="status"
      :opacity="visual.labelOpacity"
      :hovered="hovered"
      :lift="labelLift(index, ring)"
      :occluders="occluders"
      @select="select"
      @enter="enter"
      @leave="leave"
    />
  </TresGroup>
</template>
```

In `src/scene/District.vue`, add the lines: import them and derive the line houses in the script, and render them after the tower:
```vue
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import type { ProviderMeta } from "../domain/providers";
import { clampPercent } from "../domain/progress";
import type { DistrictModel } from "./cityModel";
import ConnectionLines from "./ConnectionLines.vue";
import House from "./house/House.vue";
import Tower from "./Tower.vue";

const props = defineProps<{ district: DistrictModel; highlighted: boolean; selectedId: string | null }>();
const emit = defineEmits<{ selectHouse: [id: string]; focus: [meta: ProviderMeta] }>();
const tower = useTemplateRef<InstanceType<typeof Tower>>("tower");
/** The tower body: house labels fade while it stands between them and the camera. */
const occluders = () => [tower.value?.body ?? null];
const lines = computed(() => props.district.houses.map((h) => ({ x: h.x, z: h.z, status: h.session.status })));
</script>
```
and in its template, between `<Tower … />` and `<House v-for … />`:
```vue
    <ConnectionLines :houses="lines" :provider="district.provider" />
```

- [ ] **Step 7: Type-check, test, and check parity on the busy demo city**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

The demo city has every status at once. Force the demo data in both trees (Measurement Kit), shoot both, revert:
```bash
for d in . $S/argis-main; do sed -i '' 's/  if (isTauri() \&\& !params.has("mock"))/  if (false \&\& isTauri() \&\& !params.has("mock"))/' $d/src/services/createAgentSource.ts; done
$S/shot.sh t8-vue-mock
pkill -f "argis/node_modules/.*vite/bin/vite.js"; (cd $S/argis-main && pnpm dev > $S/vite-main.log 2>&1 &); sleep 5
$S/shot.sh t8-react-mock
pkill -f "argis-main/node_modules/.*vite/bin/vite.js"; pnpm dev > $S/vite.log 2>&1 &
```
(Keep the demo-data edit in this repo for the churn check below; revert both trees at the end of this step.)
Read both screenshots. Expected in the Vue one, matching the React one: running houses with rising sparks and dashed lines flowing **towards** the tower; an "awaiting" house with the amber diamond and pulsing ground rings; a done house with the slowly turning blue halo; error/idle houses with their glow; one line per house (no extra lines joining houses to each other).

Review Focus #4 — sessions appear and vanish: the mock ticks add and remove sessions every few polls. Run `$S/target/debug/argis >/dev/null 2>&1 & app=$!`, wait 40 s, take `screencapture -x -o -l $($S/winid $app | head -1 | cut -d' ' -f1) $S/shot-t8-churn.png`, `kill $app`, then `grep -ci "error" $S/vite.log`. Expected: houses still render with shadows and glow after churn (shared geometries not disposed), no orphan labels left floating where a house was removed, and no new errors in the log. Finally revert the demo-data edit in both trees:
```bash
for d in . $S/argis-main; do git -C $d checkout src/services/createAgentSource.ts; done
```

- [ ] **Step 8: Commit**

```bash
git add src/composables/useDoneRipple.ts src/composables/useDoneRipple.test.ts src/scene/SegmentLines.vue src/scene/FlowLine.vue src/scene/ConnectionLines.vue src/scene/District.vue src/scene/house
git commit -m "feat(vue): status effects, connection lines and selection marker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 9: Shared UI pieces, overlay, empty state and camera buttons

**Files:**
- Create: `src/ui/common/IconButton.vue`, `Kbd.vue`, `Swatch.vue`, `StatusIcon.vue`, `StatusPill.vue`, `Elapsed.vue`
- Create: `src/ui/cameraCommands.ts`, `src/ui/CameraControls.vue`, `src/ui/Overlay.vue`, `src/ui/EmptyState.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useSelectionStore`, `useCameraRigStore` + `CameraRigStore`, `useNow`.
- Produces: `IconButton` props `{ label: string; shape?: "round" | "square"; size?: number }` + default slot (native `@click` falls through); `Kbd` default slot; `Swatch` props `{ color: PaletteColor; size?: number }`; `StatusIcon` props `{ icon: StatusIcon; size?: number }`; `StatusPill` props `{ status: AgentStatus }`; `Elapsed` props `{ item: { status; startedAt; updatedAt } }`; `CAMERA_COMMANDS: readonly CameraCommand[]` where `CameraCommand = { label: string; Icon: LucideIcon; run: (rig: CameraRigStore) => void }`; `Overlay` default slot.

- [ ] **Step 1: Create the shared pieces**

Create `src/ui/common/IconButton.vue`:
```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Required: icon-only buttons need an accessible name. */
    label: string;
    shape?: "round" | "square";
    size?: number;
  }>(),
  { shape: "square", size: 44 },
);
</script>

<!-- Glass icon-only button (44px round camera controls, 48px square nav, …). -->
<template>
  <button
    type="button"
    class="glass button"
    :aria-label="label"
    :title="label"
    :data-shape="shape"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <slot />
  </button>
</template>
```

Create `src/ui/common/Kbd.vue`:
```vue
<!-- Small key-cap hint ("⌘K", "esc", "↵"). -->
<template>
  <kbd class="kbd"><slot /></kbd>
</template>
```

Create `src/ui/common/Swatch.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { cssVar, type PaletteColor } from "../../domain/palette";

const props = withDefaults(defineProps<{ color: PaletteColor; size?: number }>(), { size: 10 });
const style = computed(() => ({
  display: "inline-block",
  flex: "none",
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: "3px",
  background: cssVar(props.color),
  boxShadow: `0 0 8px color-mix(in srgb, ${cssVar(props.color)} 55%, transparent)`,
}));
</script>

<!-- 10px rounded colour swatch identifying a provider. -->
<template>
  <span aria-hidden="true" :style="style" />
</template>
```

Create `src/ui/common/StatusIcon.vue`:
```vue
<script setup lang="ts">
import { Check, CircleAlert, Hand, LoaderCircle, Moon, type LucideIcon } from "@lucide/vue";
import type { StatusIcon as StatusIconName } from "../../domain/status";

const ICONS: Readonly<Record<StatusIconName, LucideIcon>> = {
  loader: LoaderCircle,
  hand: Hand,
  moon: Moon,
  check: Check,
  alert: CircleAlert,
};

withDefaults(defineProps<{ icon: StatusIconName; size?: number }>(), { size: 12 });
</script>

<!-- Maps a domain status icon name onto its Lucide glyph. -->
<template>
  <component :is="ICONS[icon]" :size="size" :stroke-width="2.2" aria-hidden="true" />
</template>
```

Create `src/ui/common/StatusPill.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { statusMeta } from "../../domain/status";
import StatusIcon from "./StatusIcon.vue";

const props = defineProps<{ status: AgentStatus }>();
const meta = computed(() => statusMeta(props.status));
</script>

<!-- Icon + label tinted by status (Running, Needs approval, Idle, Done, Error). -->
<template>
  <span class="pill" :style="{ '--tint': cssVar(meta.color) }" :data-status="status">
    <StatusIcon :icon="meta.icon" class="icon" />{{ meta.label }}
  </span>
</template>
```

Create `src/ui/common/Elapsed.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus } from "../../domain/types";
import { formatElapsed } from "../../domain/format";
import { elapsedMs } from "../../domain/session";
import { useNow } from "../../composables/useNow";

const props = defineProps<{ item: { status: AgentStatus; startedAt: number; updatedAt: number } }>();
const now = useNow();
const text = computed(() => formatElapsed(elapsedMs(props.item, now.value)));
</script>

<!-- Self-ticking elapsed timer, isolated so only this text re-renders each second. -->
<template>{{ text }}</template>
```

Append the styles:
```bash
style_from src/ui/common/IconButton.module.css src/ui/common/IconButton.vue
style_from src/ui/common/Kbd.module.css src/ui/common/Kbd.vue
style_from src/ui/common/StatusPill.module.css src/ui/common/StatusPill.vue
```

- [ ] **Step 2: Create the camera buttons, overlay and empty state**

Create `src/ui/cameraCommands.ts`:
```ts
import { RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from "@lucide/vue";
import type { CameraRigStore } from "../stores/cameraRig";

export interface CameraCommand {
  label: string;
  Icon: LucideIcon;
  run: (rig: CameraRigStore) => void;
}

/** Shared with the ⌘K palette so both surfaces offer the same camera moves. */
export const CAMERA_COMMANDS: readonly CameraCommand[] = [
  { label: "Zoom in", Icon: ZoomIn, run: (rig) => rig.zoomIn() },
  { label: "Zoom out", Icon: ZoomOut, run: (rig) => rig.zoomOut() },
  { label: "Reset view angle", Icon: RotateCcw, run: (rig) => rig.reset() },
  { label: "Fit city to view", Icon: Scan, run: (rig) => rig.fit() },
];
```

Create `src/ui/CameraControls.vue`:
```vue
<script setup lang="ts">
import { useCameraRigStore } from "../stores/cameraRig";
import { CAMERA_COMMANDS } from "./cameraCommands";
import IconButton from "./common/IconButton.vue";

const rig = useCameraRigStore();
</script>

<!-- 44px round glass buttons, bottom-left above the subagent strip. -->
<template>
  <div class="controls" role="toolbar" aria-label="Camera">
    <IconButton
      v-for="command in CAMERA_COMMANDS"
      :key="command.label"
      :label="command.label"
      shape="round"
      :size="44"
      @click="command.run(rig)"
    >
      <component :is="command.Icon" :size="18" aria-hidden="true" />
    </IconButton>
  </div>
</template>
```

Create `src/ui/Overlay.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSelectionStore } from "../stores/selection";

const { selectedSession } = storeToRefs(useSelectionStore());
const hasStrip = computed(() => (selectedSession.value?.session.subagents.length ?? 0) > 0);
</script>

<!--
  Full-window UI layer above the canvas. Click-through by default; panels opt
  back in. Exposes `--strip-space` so siblings can clear the subagent strip.
-->
<template>
  <div class="overlay" :data-strip="hasStrip">
    <div class="scrim" aria-hidden="true" />
    <slot />
  </div>
</template>
```

Create `src/ui/EmptyState.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { CircleAlert, Radar } from "@lucide/vue";
import type { Snapshot } from "../domain/types";
import { useSnapshotStore } from "../stores/snapshot";

interface Message {
  title: string;
  body: string;
  tone: "info" | "error";
  retry?: boolean;
}

function messageFor(snapshot: Snapshot | null, error: string | null): Message | null {
  if (!snapshot) {
    return error
      ? { title: "Can't reach the Argis backend", body: error, tone: "error", retry: true }
      : { title: "Scanning for agents…", body: "Looking for Claude Code, Codex, OpenCode and Pi sessions.", tone: "info" };
  }
  if (snapshot.sessions.length > 0) return null;
  const installed = snapshot.providers.some((p) => p.available);
  if (snapshot.providers.length > 0 && !installed) {
    return {
      title: "No supported agent tools found",
      body: "Install Claude Code, Codex, OpenCode or Pi — their towers light up here as soon as a session starts.",
      tone: "info",
    };
  }
  return null; // "no live agents" is shown inside the Agents list
}

const snapshots = useSnapshotStore();
const { snapshot, error } = storeToRefs(snapshots);
const message = computed(() => messageFor(snapshot.value, error.value));
</script>

<!-- Loading, backend-error and "no agent tools installed" states. -->
<template>
  <div v-if="message" class="glass card" :data-tone="message.tone" role="status">
    <component :is="message.tone === 'error' ? CircleAlert : Radar" :size="20" class="icon" aria-hidden="true" />
    <div class="text">
      <p class="title">{{ message.title }}</p>
      <p class="body">{{ message.body }}</p>
    </div>
    <button v-if="message.retry" type="button" class="retry" @click="snapshots.refresh()">Retry</button>
  </div>
</template>
```

Append the styles:
```bash
style_from src/ui/CameraControls.module.css src/ui/CameraControls.vue
style_from src/ui/Overlay.module.css src/ui/Overlay.vue
style_from src/ui/EmptyState.module.css src/ui/EmptyState.vue
```

- [ ] **Step 3: Compose them in the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Overlay from "./ui/Overlay.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <CameraControls />
    <EmptyState />
  </Overlay>
</template>
```

- [ ] **Step 4: Type-check, test, and compare**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

With the dev server running: `$S/shot.sh t9-vue`, and the React reference `$S/shot.sh t9-react` (Measurement Kit). Expected: the four round camera buttons bottom-left look identical (glass, 44 px, same icons and spacing). Ask the user to click each camera button in the test window: zoom in, zoom out, reset angle, fit — each animates the camera like the React build.

Review Focus #1 — backend unreachable: stop the dev server, start the test binary, then start the dev server (the app loads but the first `get_snapshot` races the backend). Easier and deterministic: temporarily make `getSnapshot` reject in `src/services/tauriAgentSource.ts` (`getSnapshot: () => Promise.reject(new Error("backend down")),`), screenshot with `$S/shot.sh t9-error`, then `git checkout src/services/tauriAgentSource.ts`. Expected: the error card "Can't reach the Argis backend" with "backend down" and a Retry button, until the next pushed snapshot (≤ 2 s) replaces it with the city.

- [ ] **Step 5: Commit**

```bash
git add src/ui/common src/ui/cameraCommands.ts src/ui/CameraControls.vue src/ui/Overlay.vue src/ui/EmptyState.vue src/App.vue
git commit -m "feat(vue): shared UI pieces, overlay, empty state and camera buttons

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Hero column

**Files:**
- Create: `src/ui/Hero/Hero.vue`, `src/ui/Hero/HeroHeading.vue`, `src/ui/Hero/DistrictList.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useSelectionStore` (`selection`, `toggleProvider`), `Swatch`; `PROVIDER_ORDER`, `PROVIDERS`.

- [ ] **Step 1: Create the components**

Create `src/ui/Hero/HeroHeading.vue`:
```vue
<template>
  <div class="heading">
    <h1 class="title">Agent<br />Infrastructure</h1>
    <p class="description">
      Every coding agent running on this machine, mapped as a living city — one tower per tool,
      one house per live session.
    </p>
  </div>
</template>
```

Create `src/ui/Hero/DistrictList.vue`:
```vue
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { PROVIDER_ORDER, PROVIDERS } from "../../domain/providers";
import type { ProviderId, Snapshot } from "../../domain/types";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import Swatch from "../common/Swatch.vue";

function countLabel(snapshot: Snapshot | null, provider: ProviderId): string {
  if (!snapshot) return "—";
  const summary = snapshot.providers.find((p) => p.provider === provider);
  if (summary && !summary.available) return "Not installed";
  const count = snapshot.sessions.filter((s) => s.provider === provider).length;
  return `${count} ${count === 1 ? "house" : "houses"}`;
}

const { snapshot } = storeToRefs(useSnapshotStore());
const selectionStore = useSelectionStore();
const { selection } = storeToRefs(selectionStore);
</script>

<!-- One row per provider; selecting a row focuses the camera on its tower. -->
<template>
  <div class="block">
    <h2 class="caps">Districts</h2>
    <ul class="list">
      <li v-for="id in PROVIDER_ORDER" :key="id">
        <button
          type="button"
          class="row"
          :aria-pressed="selection.provider === id"
          @click="selectionStore.toggleProvider(id)"
        >
          <Swatch :color="PROVIDERS[id].color" />
          <span class="name">{{ PROVIDERS[id].label }}</span>
          <span class="count">{{ countLabel(snapshot, id) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
```

Create `src/ui/Hero/Hero.vue`:
```vue
<script setup lang="ts">
import DistrictList from "./DistrictList.vue";
import HeroHeading from "./HeroHeading.vue";
</script>

<!-- Left column: headline, description and the district filter list. -->
<template>
  <section class="hero" aria-label="Overview">
    <HeroHeading />
    <DistrictList />
  </section>
</template>
```

Append the styles:
```bash
style_from src/ui/Hero/HeroHeading.module.css src/ui/Hero/HeroHeading.vue
style_from src/ui/Hero/DistrictList.module.css src/ui/Hero/DistrictList.vue
style_from src/ui/Hero/Hero.module.css src/ui/Hero/Hero.vue
```

- [ ] **Step 2: Add it to the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <Hero />
    <CameraControls />
    <EmptyState />
  </Overlay>
</template>
```

- [ ] **Step 3: Type-check, test, and compare**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

`$S/shot.sh t10-vue` and the React reference `$S/shot.sh t10-react`. Expected: headline on two lines ("Agent" / "Infrastructure"), the description wrapping identically, and the DISTRICTS list with swatches and "N houses" / "Not installed" counts in the same places. Ask the user to click a district row (camera focuses that tower, row shows pressed) and click it again (camera returns to the whole city).

- [ ] **Step 4: Commit**

```bash
git add src/ui/Hero/Hero.vue src/ui/Hero/HeroHeading.vue src/ui/Hero/DistrictList.vue src/App.vue
git commit -m "feat(vue): hero column with district list

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Agent list

**Files:**
- Create: `src/ui/AgentList/AgentList.vue`, `AgentGroup.vue`, `AgentRow.vue`, `StatusChips.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useSelectionStore` (`selectSession`), `useCameraRigStore` (`focusSession`), `useHoverStore`; `groupSessions`, `statusCounts`, `toggleFilter`, `visibleChips`, `StatusFilter`, `StatusCount`, `AgentGroup` (`domain/agentList.ts`); `Swatch`, `Elapsed`.
- Produces: `<AgentList />` (no props). `AgentGroup` emits `select(id)`; `AgentRow` emits `select(id)`; `StatusChips` props `{ counts; filter }`, emits `toggle(status)`.

- [ ] **Step 1: Create the components**

Create `src/ui/AgentList/StatusChips.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus } from "../../domain/types";
import { visibleChips, type StatusCount, type StatusFilter } from "../../domain/agentList";
import { cssVar } from "../../domain/palette";
import { statusMeta } from "../../domain/status";

const props = defineProps<{ counts: readonly StatusCount[]; filter: StatusFilter }>();
const emit = defineEmits<{ toggle: [status: AgentStatus] }>();
const chips = computed(() => visibleChips(props.counts, props.filter));
</script>

<!-- Running · Needs you · Idle · Done · Error — non-zero only; click to filter. -->
<template>
  <div v-if="chips.length > 0" class="chips" role="group" aria-label="Filter by status">
    <button
      v-for="chip in chips"
      :key="chip.status"
      type="button"
      class="chip"
      :style="{ '--tint': cssVar(statusMeta(chip.status).color) }"
      :aria-pressed="filter === chip.status"
      :data-dimmed="filter != null && filter !== chip.status"
      @click="emit('toggle', chip.status)"
    >
      <span class="dot" aria-hidden="true" />{{ statusMeta(chip.status).chipLabel }}<span class="count">{{ chip.count }}</span>
    </button>
  </div>
</template>
```

Create `src/ui/AgentList/AgentRow.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { GitFork } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import { formatPercent } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { clampPercent } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import { useHoverStore } from "../../stores/hover";
import Elapsed from "../common/Elapsed.vue";

const props = defineProps<{ session: AgentSession }>();
const emit = defineEmits<{ select: [id: string] }>();
const hover = useHoverStore();
const hovered = computed(() => hover.hoveredId === props.session.id);
const meta = computed(() => statusMeta(props.session.status));
const enter = () => hover.set(props.session.id);
const leave = () => hover.clear(props.session.id);
</script>

<!-- Status accent + dot, title, `model · elapsed`, progress % and subagent badge. -->
<template>
  <li>
    <button
      type="button"
      class="row"
      :style="{ '--tint': cssVar(meta.color) }"
      :data-status="session.status"
      :data-hovered="hovered"
      @click="emit('select', session.id)"
      @pointerenter="enter"
      @pointerleave="leave"
      @focus="enter"
      @blur="leave"
    >
      <span class="accent" aria-hidden="true" />
      <span class="dot" aria-hidden="true" />
      <span class="main">
        <span class="title">{{ session.title }}</span>
        <span class="sub">{{ session.model ?? "unknown model" }} · <Elapsed :item="session" /></span>
      </span>
      <span class="side">
        <span class="percent">{{ formatPercent(clampPercent(session.progress.percent)) }}</span>
        <span v-if="session.subagents.length > 0" class="badge" :title="`${session.subagents.length} subagents`">
          <GitFork :size="10" aria-hidden="true" />{{ session.subagents.length }}
        </span>
      </span>
      <span class="sr-only">{{ meta.label }}</span>
    </button>
  </li>
</template>
```

Create `src/ui/AgentList/AgentGroup.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { AgentGroup as AgentGroupModel } from "../../domain/agentList";
import Swatch from "../common/Swatch.vue";
import AgentRow from "./AgentRow.vue";

const props = defineProps<{ group: AgentGroupModel }>();
const emit = defineEmits<{ select: [id: string] }>();
const headingId = computed(() => `agents-${props.group.provider}`);
</script>

<!-- Caps header (swatch · provider · count) followed by its session rows. -->
<template>
  <section class="group" :aria-labelledby="headingId">
    <h3 :id="headingId" class="caps heading">
      <Swatch :color="group.meta.color" :size="8" />
      <span class="name">{{ group.meta.label }}</span>
      <span class="count">{{ group.sessions.length }}</span>
    </h3>
    <ul class="rows">
      <AgentRow v-for="session in group.sessions" :key="session.id" :session="session" @select="emit('select', $event)" />
    </ul>
  </section>
</template>
```

Create `src/ui/AgentList/AgentList.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import type { AgentStatus } from "../../domain/types";
import { groupSessions, statusCounts, toggleFilter, type StatusFilter } from "../../domain/agentList";
import { useCameraRigStore } from "../../stores/cameraRig";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import AgentGroup from "./AgentGroup.vue";
import StatusChips from "./StatusChips.vue";

const { snapshot } = storeToRefs(useSnapshotStore());
const selection = useSelectionStore();
const rig = useCameraRigStore();
const filter = ref<StatusFilter>(null);
const sessions = computed(() => snapshot.value?.sessions ?? []);
const counts = computed(() => statusCounts(sessions.value));
const groups = computed(() => groupSessions(sessions.value, filter.value));

function onToggle(status: AgentStatus): void {
  filter.value = toggleFilter(filter.value, status);
}
function onSelect(id: string): void {
  selection.selectSession(id);
  rig.focusSession(id);
}
</script>

<!-- Right-column list of every live session, grouped by provider, filterable by status. -->
<template>
  <section class="glass panel" aria-label="Agents">
    <header class="header">
      <h2 class="title">Agents <span class="total">{{ sessions.length }}</span></h2>
      <StatusChips :counts="counts" :filter="filter" @toggle="onToggle" />
    </header>
    <div class="thin-scroll body">
      <AgentGroup v-for="group in groups" :key="group.provider" :group="group" @select="onSelect" />
      <div v-if="groups.length === 0" class="empty">
        <p>{{ !snapshot ? "Scanning for agents…" : filter ? "No agents with this status." : "No live agents right now." }}</p>
        <button v-if="filter" type="button" class="clear" @click="filter = null">Clear filter</button>
        <p v-else-if="snapshot" class="hint">Start a Claude Code, Codex, OpenCode or Pi session.</p>
      </div>
    </div>
  </section>
</template>
```

Append the styles:
```bash
style_from src/ui/AgentList/StatusChips.module.css src/ui/AgentList/StatusChips.vue
style_from src/ui/AgentList/AgentRow.module.css src/ui/AgentList/AgentRow.vue
style_from src/ui/AgentList/AgentGroup.module.css src/ui/AgentList/AgentGroup.vue
style_from src/ui/AgentList/AgentList.module.css src/ui/AgentList/AgentList.vue
```

- [ ] **Step 2: Type-check and test**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass. (The list is wired into the app by Task 12's `RightColumn`; it is compared visually there.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/AgentList/AgentList.vue src/ui/AgentList/AgentGroup.vue src/ui/AgentList/AgentRow.vue src/ui/AgentList/StatusChips.vue
git commit -m "feat(vue): agent list with status filter chips

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Agent detail panel and the right column

**Files:**
- Create: `src/ui/AgentPanel/AgentPanel.vue`, `PanelHeader.vue`, `ProgressSection.vue`, `ProgressRing.vue`, `PanelStats.vue`, `StatTile.vue`, `ContextBar.vue`, `MetaRows.vue`, `PanelActions.vue`
- Create: `src/ui/RightColumn.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSelectionStore` (`selectedSession`, `clearSession`), `useAgentSource` (`openPath`), `StatusPill`, `Swatch`, `Elapsed`, `<AgentList />` (Task 11); `SelectedSession` (`domain/session.ts`).
- Produces: `AgentPanel` props `{ selected: SelectedSession }`, emits `back`, `close`; `StatTile` props `{ label }` with `#value` and `#caption` slots.

- [ ] **Step 1: Create the panel parts**

Create `src/ui/AgentPanel/StatTile.vue`:
```vue
<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<!-- Small boxed metric: label, 24/500 value, caption. -->
<template>
  <div class="tile">
    <span class="label">{{ label }}</span>
    <span class="value"><slot name="value" /></span>
    <span class="caption"><slot name="caption" /></span>
  </div>
</template>
```

Create `src/ui/AgentPanel/PanelStats.vue`:
```vue
<script setup lang="ts">
import type { AgentSession } from "../../domain/types";
import { formatClock, formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";
import Elapsed from "../common/Elapsed.vue";
import StatTile from "./StatTile.vue";

function tokensCaption(session: AgentSession): string {
  const share = contextShare(session.tokens);
  const window = session.tokens.contextWindow;
  if (share != null && window != null) return `${Math.round(share * 100)}% of ${formatCompact(window)} ctx`;
  return `${formatTokens(session.tokens.output)} output`;
}

defineProps<{ session: AgentSession }>();
</script>

<!-- Tokens and Elapsed tiles side by side. -->
<template>
  <div class="row">
    <StatTile label="Tokens">
      <template #value>{{ formatTokens(session.tokens.total) }}</template>
      <template #caption>{{ tokensCaption(session) }}</template>
    </StatTile>
    <StatTile label="Elapsed">
      <template #value><Elapsed :item="session" /></template>
      <template #caption>since {{ formatClock(session.startedAt) }}</template>
    </StatTile>
  </div>
</template>
```

Create `src/ui/AgentPanel/ProgressRing.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 0–1 fill. */
    fraction: number;
    label: string;
    caption: string;
    size?: number;
    stroke?: number;
  }>(),
  { size: 112, stroke: 8 },
);
const radius = computed(() => (props.size - props.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const clamped = computed(() => Math.min(1, Math.max(0, props.fraction)));
</script>

<!-- SVG ring: faint track, accent arc with glow, centred value + caption. -->
<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`${label} ${caption}`">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="track" :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="stroke" />
      <circle
        class="arc"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        :stroke-width="stroke"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - clamped)"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="center">
      <span class="value">{{ label }}</span>
      <span class="caption">{{ caption }}</span>
    </div>
  </div>
</template>
```

Create `src/ui/AgentPanel/ProgressSection.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Progress } from "../../domain/types";
import { displayProgress, progressFraction } from "../../domain/progress";
import ProgressRing from "./ProgressRing.vue";

const props = defineProps<{ progress: Progress; currentStep: string | null }>();
const display = computed(() => displayProgress(props.progress));
</script>

<!-- Progress ring beside the "CURRENT STEP" summary. -->
<template>
  <section class="section">
    <ProgressRing :fraction="progressFraction(progress)" :label="display.label" :caption="display.caption" />
    <div class="step">
      <h3 class="caps">Current step</h3>
      <p class="text">{{ currentStep ?? "No recent activity" }}</p>
      <p v-if="display.detail" class="detail">{{ display.detail }}</p>
    </div>
  </section>
</template>
```

Create `src/ui/AgentPanel/ContextBar.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { TokenUsage } from "../../domain/types";
import { formatCompact, formatTokens } from "../../domain/format";
import { contextShare } from "../../domain/session";

type Level = "ok" | "high" | "full";

function levelOf(share: number): Level {
  if (share >= 0.95) return "full";
  return share >= 0.8 ? "high" : "ok";
}

const props = defineProps<{ tokens: TokenUsage }>();
const share = computed(() => contextShare(props.tokens));
const readout = computed(() => {
  const { contextUsed, contextWindow } = props.tokens;
  return share.value != null && contextUsed != null && contextWindow != null
    ? `${formatTokens(contextUsed)} / ${formatCompact(contextWindow)}`
    : "Unknown";
});
</script>

<!-- 6px context-window bar with used / window readout. -->
<template>
  <div class="block">
    <div class="head">
      <span class="caps">Context window</span>
      <span class="readout">{{ readout }}</span>
    </div>
    <div
      class="track"
      role="meter"
      aria-label="Context window usage"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="share == null ? undefined : Math.round(share * 100)"
    >
      <span class="fill" :data-level="share == null ? 'ok' : levelOf(share)" :style="{ width: `${(share ?? 0) * 100}%` }" />
    </div>
  </div>
</template>
```

Create `src/ui/AgentPanel/MetaRows.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { Folder, GitFork, SquareTerminal, type LucideIcon } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import { tildify } from "../../domain/format";
import { subagentCounts } from "../../domain/session";

interface Row {
  label: string;
  value: string;
  title?: string;
  Icon: LucideIcon;
}

function subagentText(session: AgentSession): string {
  const { total, running } = subagentCounts(session);
  return total === 0 ? "None" : `${total} · ${running} running`;
}

const props = defineProps<{ session: AgentSession }>();
const rows = computed<Row[]>(() => [
  { label: "Directory", value: tildify(props.session.cwd), title: props.session.cwd, Icon: Folder },
  { label: "Terminal / PID", value: props.session.pid != null ? String(props.session.pid) : "—", Icon: SquareTerminal },
  { label: "Subagents", value: subagentText(props.session), Icon: GitFork },
]);
</script>

<!-- Directory, Terminal / PID and Subagents rows. -->
<template>
  <dl class="rows">
    <div v-for="row in rows" :key="row.label" class="row">
      <dt class="label"><component :is="row.Icon" :size="14" aria-hidden="true" />{{ row.label }}</dt>
      <dd class="value" :title="row.title">{{ row.value }}</dd>
    </div>
  </dl>
</template>
```

Create `src/ui/AgentPanel/PanelActions.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { Check, Copy, FolderOpen } from "@lucide/vue";
import { useAgentSource } from "../../composables/useAgentSource";

const props = defineProps<{ cwd: string }>();
const source = useAgentSource();
const copied = ref(false);
const { start: resetCopiedLater } = useTimeoutFn(() => (copied.value = false), 1_500, { immediate: false });

function openFolder(): void {
  source.openPath(props.cwd).catch((error: unknown) => console.error("[argis] open_path failed", error));
}
function copyPath(): void {
  navigator.clipboard?.writeText(props.cwd).then(
    () => {
      copied.value = true;
      resetCopiedLater();
    },
    () => (copied.value = false),
  );
}
</script>

<!-- Primary "Open folder" (reveals cwd via the backend) + copy-path ghost button. -->
<template>
  <div class="actions">
    <button type="button" class="primary" @click="openFolder"><FolderOpen :size="16" aria-hidden="true" />Open folder</button>
    <button
      type="button"
      class="ghost"
      :aria-label="copied ? 'Path copied' : 'Copy directory path'"
      title="Copy directory path"
      @click="copyPath"
    >
      <Check v-if="copied" :size="16" aria-hidden="true" />
      <Copy v-else :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
```

Create `src/ui/AgentPanel/PanelHeader.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, X } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import type { ProviderMeta } from "../../domain/providers";
import { formatHouseNumber } from "../../domain/format";
import StatusPill from "../common/StatusPill.vue";
import Swatch from "../common/Swatch.vue";

const props = defineProps<{ session: AgentSession; meta: ProviderMeta; houseNumber: number }>();
const emit = defineEmits<{ back: []; close: [] }>();
const details = computed(() =>
  [props.session.model, props.session.pid != null ? `PID ${props.session.pid}` : null].filter(Boolean).join(" · "),
);
</script>

<!-- Crumb, title, back + close buttons, then status pill + `model · PID`. -->
<template>
  <header class="header">
    <div class="top">
      <div class="heading">
        <p class="crumb"><Swatch :color="meta.color" />{{ meta.label }} · House {{ formatHouseNumber(houseNumber) }}</p>
        <h2 class="title" :title="session.title">{{ session.title }}</h2>
      </div>
      <div class="buttons">
        <button type="button" class="iconButton" aria-label="Back to agent list" @click="emit('back')">
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="iconButton" aria-label="Close details" @click="emit('close')">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="status">
      <StatusPill :status="session.status" />
      <span v-if="details" class="details">{{ details }}</span>
    </div>
  </header>
</template>
```

Create `src/ui/AgentPanel/AgentPanel.vue`:
```vue
<script setup lang="ts">
import { cssVar } from "../../domain/palette";
import type { SelectedSession } from "../../domain/session";
import ContextBar from "./ContextBar.vue";
import MetaRows from "./MetaRows.vue";
import PanelActions from "./PanelActions.vue";
import PanelHeader from "./PanelHeader.vue";
import PanelStats from "./PanelStats.vue";
import ProgressSection from "./ProgressSection.vue";

defineProps<{ selected: SelectedSession }>();
const emit = defineEmits<{ back: []; close: [] }>();
</script>

<!-- Detail panel for the selected house; lives in the right column in place of the list. -->
<template>
  <aside
    class="glass panel"
    :style="{ '--accent': cssVar(selected.meta.color) }"
    :aria-label="`${selected.session.title} details`"
  >
    <PanelHeader
      :session="selected.session"
      :meta="selected.meta"
      :house-number="selected.houseNumber"
      @back="emit('back')"
      @close="emit('close')"
    />
    <ProgressSection :progress="selected.session.progress" :current-step="selected.session.currentStep" />
    <PanelStats :session="selected.session" />
    <ContextBar :tokens="selected.session.tokens" />
    <MetaRows :session="selected.session" />
    <PanelActions :cwd="selected.session.cwd" />
  </aside>
</template>
```

Append the styles:
```bash
for c in StatTile PanelStats ProgressRing ProgressSection ContextBar MetaRows PanelActions PanelHeader AgentPanel; do
  style_from src/ui/AgentPanel/$c.module.css src/ui/AgentPanel/$c.vue
done
```

- [ ] **Step 2: Create the right column**

Create `src/ui/RightColumn.vue`:
```vue
<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import { storeToRefs } from "pinia";
import type { SelectedSession } from "../domain/session";
import { useSelectionStore } from "../stores/selection";
import AgentList from "./AgentList/AgentList.vue";
import AgentPanel from "./AgentPanel/AgentPanel.vue";

const selection = useSelectionStore();
const { selectedSession } = storeToRefs(selection);
const open = computed(() => selectedSession.value != null);

// Keep the panel's content while it fades out after the selection clears.
const shown = shallowRef<SelectedSession | null>(selectedSession.value);
watch(selectedSession, (next) => {
  if (next) shown.value = next;
});

// Keyboard focus follows the visible slot.
const listSlot = useTemplateRef<HTMLDivElement>("listSlot");
const panelSlot = useTemplateRef<HTMLDivElement>("panelSlot");
watch(
  open,
  (isOpen) => {
    const [from, to] = isOpen ? [listSlot.value, panelSlot.value] : [panelSlot.value, listSlot.value];
    const active = document.activeElement;
    if (active && from?.contains(active)) to?.querySelector<HTMLElement>("button")?.focus();
  },
  { flush: "post" },
);
</script>

<!--
  Right-hand column: the Agents list by default, the detail panel while a
  session is selected. Both stay mounted and crossfade (~200 ms); the hidden
  one is `inert`, and keyboard focus follows the visible one.
-->
<template>
  <div class="column">
    <div ref="listSlot" class="slot" data-kind="list" :data-active="!open" :inert="open">
      <AgentList />
    </div>
    <div ref="panelSlot" class="slot" data-kind="panel" :data-active="open" :inert="!open">
      <AgentPanel v-if="shown" :selected="shown" @back="selection.clearSession()" @close="selection.clearSession()" />
    </div>
  </div>
</template>
```
```bash
style_from src/ui/RightColumn.module.css src/ui/RightColumn.vue
```

- [ ] **Step 3: Add it to the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <Hero />
    <CameraControls />
    <EmptyState />
    <RightColumn />
  </Overlay>
</template>
```

- [ ] **Step 4: Type-check, test, and compare**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

With demo data forced in both trees (Measurement Kit): `$S/shot.sh t12-vue`, `$S/shot.sh t12-react`. Expected: the Agents panel matches — title with count, status chips, provider groups with swatches, rows with accent bar, dot, title, `model · elapsed`, percent and subagent badge. Elapsed times tick each second.

Ask the user to check in the test window: hovering a row lifts and brightens its house and vice versa (Review: hover sync); clicking a row selects the house, the camera centres on it, and the panel crossfades in with the header, progress ring, Tokens/Elapsed tiles, context bar, meta rows and actions; "Open folder" reveals the directory in Finder; copy shows a check for 1.5 s; back and close return to the list. Review Focus #2: in the demo city, select a house and wait for the mock to remove it (or ask the user to quit that agent) — the panel fades out showing its last content and the list returns; when a session with that id reappears it is not re-selected. Revert the demo-data edits afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AgentPanel/*.vue src/ui/RightColumn.vue src/App.vue
git commit -m "feat(vue): agent detail panel and right column

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Command palette (⌘K)

**Files:**
- Create: `src/composables/useCommandActions.ts`
- Create: `src/ui/CommandPalette/CommandPalette.vue`, `PaletteBody.vue`, `PaletteSection.vue`, `PaletteOption.vue`, `paletteOption.ts`, `Highlight.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useSelectionStore`, `useCameraRigStore`, `useAgentSource`, `CAMERA_COMMANDS`, `Kbd`, `StatusPill`, `Swatch`; `searchActions`, `searchSessions`, `tokenize`, `wrapIndex`, `highlight`, `Searchable` (`domain/search.ts`).
- Produces: `useCommandActions(): ComputedRef<CommandAction[]>` with `CommandAction extends Searchable { id: string; Icon: LucideIcon; color?: PaletteColor; hint?: string; run: () => void }`; `<CommandPalette v-model:open="…" />`.

- [ ] **Step 1: Create the actions composable**

Create `src/composables/useCommandActions.ts`:
```ts
import { computed, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { Copy, FolderOpen, Map as MapIcon, MapPin, RefreshCw, X, type LucideIcon } from "@lucide/vue";
import type { PaletteColor } from "../domain/palette";
import { PROVIDER_ORDER, PROVIDERS } from "../domain/providers";
import type { Searchable } from "../domain/search";
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

/** Palette actions: selected-agent shortcuts first, then districts, camera, refresh. */
export function useCommandActions(): ComputedRef<CommandAction[]> {
  const rig = useCameraRigStore();
  const source = useAgentSource();
  const snapshots = useSnapshotStore();
  const selectionStore = useSelectionStore();
  const { selection, selectedSession } = storeToRefs(selectionStore);

  return computed(() => {
    const actions: CommandAction[] = [];
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
```

- [ ] **Step 2: Create the palette components**

Create `src/ui/CommandPalette/paletteOption.ts`:
```ts
import type { AgentSession } from "../../domain/types";
import type { CommandAction } from "../../composables/useCommandActions";

/** One row in the palette: a live agent or an app action. */
export type PaletteOptionModel =
  | { key: string; kind: "agent"; session: AgentSession }
  | { key: string; kind: "action"; action: CommandAction };
```

Create `src/ui/CommandPalette/Highlight.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { highlight } from "../../domain/search";

const props = defineProps<{ text: string; query: string }>();
const segments = computed(() => highlight(props.text, props.query));
</script>

<!-- `text` with the parts matching `query` emphasised. -->
<template>
  <template v-for="(segment, i) in segments" :key="i">
    <mark v-if="segment.match" class="mark">{{ segment.text }}</mark>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>
```

Create `src/ui/CommandPalette/PaletteOption.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { tildify } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { PROVIDERS } from "../../domain/providers";
import { statusMeta } from "../../domain/status";
import StatusPill from "../common/StatusPill.vue";
import Swatch from "../common/Swatch.vue";
import Highlight from "./Highlight.vue";
import type { PaletteOptionModel } from "./paletteOption";

const props = defineProps<{ option: PaletteOptionModel; domId: string; active: boolean; query: string }>();
const emit = defineEmits<{ hover: []; run: [] }>();
const tint = computed(() =>
  props.option.kind === "agent" ? { "--tint": cssVar(statusMeta(props.option.session.status).color) } : undefined,
);
</script>

<!--
  listbox option: hover moves the cursor, click runs it; focus stays in the input.
  Agent: status dot · title · `provider · model · ~/dir` · status pill.
  Action: icon tile (or provider swatch) · label · optional context hint.
-->
<template>
  <div
    :id="domId"
    role="option"
    :aria-selected="active"
    class="option"
    :style="tint"
    @pointermove="!active && emit('hover')"
    @mousedown.prevent
    @click="emit('run')"
  >
    <template v-if="option.kind === 'agent'">
      <span class="dot" :data-status="option.session.status" aria-hidden="true" />
      <span class="main">
        <span class="label"><Highlight :text="option.session.title" :query="query" /></span>
        <span class="sub">{{ PROVIDERS[option.session.provider].label }} · {{ option.session.model ?? "unknown model" }} · {{ tildify(option.session.cwd) }}</span>
      </span>
      <StatusPill :status="option.session.status" />
    </template>
    <template v-else>
      <span class="tile">
        <Swatch v-if="option.action.color" :color="option.action.color" />
        <component :is="option.action.Icon" v-else :size="16" aria-hidden="true" />
      </span>
      <span class="main">
        <span class="label"><Highlight :text="option.action.label" :query="query" /></span>
      </span>
      <span v-if="option.action.hint" class="hint">{{ option.action.hint }}</span>
    </template>
  </div>
</template>
```

Create `src/ui/CommandPalette/PaletteSection.vue`:
```vue
<script setup lang="ts">
import { useId } from "vue";

defineProps<{ title: string; aside?: string | null }>();
const headingId = useId();
</script>

<template>
  <div role="group" :aria-labelledby="headingId" class="section">
    <div class="heading">
      <span :id="headingId" class="caps">{{ title }}</span>
      <span v-if="aside" class="aside">{{ aside }}</span>
    </div>
    <slot />
  </div>
</template>
```

Create `src/ui/CommandPalette/PaletteBody.vue`:
```vue
<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from "vue";
import { storeToRefs } from "pinia";
import { Search } from "@lucide/vue";
import { searchActions, searchSessions, tokenize, wrapIndex } from "../../domain/search";
import { useCommandActions } from "../../composables/useCommandActions";
import { useCameraRigStore } from "../../stores/cameraRig";
import { useSelectionStore } from "../../stores/selection";
import { useSnapshotStore } from "../../stores/snapshot";
import Kbd from "../common/Kbd.vue";
import PaletteOption from "./PaletteOption.vue";
import PaletteSection from "./PaletteSection.vue";
import type { PaletteOptionModel } from "./paletteOption";

/** Agents listed before the user types anything (most urgent first). */
const IDLE_AGENT_LIMIT = 6;

const emit = defineEmits<{ close: [] }>();
const { snapshot } = storeToRefs(useSnapshotStore());
const selection = useSelectionStore();
const rig = useCameraRigStore();
const actions = useCommandActions();
const query = ref("");
// Track the cursor by key so live snapshot reordering doesn't move it.
const activeKey = ref<string | null>(null);
const listId = useId();
const list = useTemplateRef<HTMLDivElement>("list");

const sessions = computed(() => snapshot.value?.sessions ?? []);
const agents = computed(() => searchSessions(sessions.value, query.value, IDLE_AGENT_LIMIT));
const matchedActions = computed(() => searchActions(actions.value, query.value));
const options = computed<PaletteOptionModel[]>(() => [
  ...agents.value.map((session) => ({ key: `agent:${session.id}`, kind: "agent" as const, session })),
  ...matchedActions.value.map((action) => ({ key: `action:${action.id}`, kind: "action" as const, action })),
]);
const activeIndex = computed(() => {
  const found = options.value.findIndex((o) => o.key === activeKey.value);
  return found >= 0 ? found : options.value.length > 0 ? 0 : -1;
});
const optionId = (index: number) => `${listId}-option-${index}`;
const agentsAside = computed(() => {
  if (tokenize(query.value).length > 0) return String(agents.value.length);
  return sessions.value.length > agents.value.length
    ? `${agents.value.length} of ${sessions.value.length} · type to search`
    : null;
});

function run(option: PaletteOptionModel): void {
  emit("close");
  if (option.kind === "action") return option.action.run();
  selection.selectSession(option.session.id);
  rig.focusSession(option.session.id);
}

function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  activeKey.value = null;
  list.value?.scrollTo({ top: 0 });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = wrapIndex(activeIndex.value, event.key === "ArrowDown" ? 1 : -1, options.value.length);
    activeKey.value = options.value[next]?.key ?? null;
    // Only keyboard moves scroll; hover and live updates leave the scroll position alone.
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" && activeIndex.value >= 0) {
    event.preventDefault();
    run(options.value[activeIndex.value]);
  }
}
</script>

<!-- Mounted only while open, so every opening starts with an empty query. -->
<template>
  <div class="search">
    <Search :size="18" class="searchIcon" aria-hidden="true" />
    <input
      class="input"
      type="text"
      role="combobox"
      aria-expanded="true"
      :aria-controls="listId"
      aria-autocomplete="list"
      :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
      aria-label="Search agents and actions"
      placeholder="Search agents or run an action…"
      autocomplete="off"
      spellcheck="false"
      :value="query"
      @input="onInput"
      @keydown="onKeydown"
    />
    <Kbd>esc</Kbd>
  </div>

  <div :id="listId" ref="list" role="listbox" aria-label="Results" class="thin-scroll results">
    <PaletteSection v-if="agents.length > 0" title="Agents" :aside="agentsAside">
      <PaletteOption
        v-for="(option, i) in options.slice(0, agents.length)"
        :key="option.key"
        :option="option"
        :dom-id="optionId(i)"
        :active="i === activeIndex"
        :query="query"
        @hover="activeKey = option.key"
        @run="run(option)"
      />
    </PaletteSection>
    <PaletteSection v-if="matchedActions.length > 0" title="Actions">
      <PaletteOption
        v-for="(option, i) in options.slice(agents.length)"
        :key="option.key"
        :option="option"
        :dom-id="optionId(agents.length + i)"
        :active="agents.length + i === activeIndex"
        :query="query"
        @hover="activeKey = option.key"
        @run="run(option)"
      />
    </PaletteSection>
    <p v-if="options.length === 0" class="empty">No agents or actions match “{{ query.trim() }}”.</p>
  </div>

  <footer class="footer" aria-hidden="true">
    <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
    <span><Kbd>↵</Kbd> open</span>
    <span><Kbd>esc</Kbd> close</span>
  </footer>
</template>
```

Create `src/ui/CommandPalette/CommandPalette.vue`:
```vue
<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import PaletteBody from "./PaletteBody.vue";

const open = defineModel<boolean>("open", { required: true });
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
let pressedBackdrop = false;

watch(
  open,
  (isOpen, _previous, onCleanup) => {
    const el = dialog.value;
    if (!el || !isOpen) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    el.querySelector("input")?.focus();
    onCleanup(() => {
      el.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  },
  { flush: "post" },
);

function close(): void {
  open.value = false;
}
// Escape closes the palette only — preventDefault keeps the selection's Escape handler out of it.
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
}
// A stale `close` event (fired after a quick close → reopen) must not shut it again.
function onClose(event: Event): void {
  if (!(event.currentTarget as HTMLDialogElement).open) close();
}
function onMousedown(event: MouseEvent): void {
  pressedBackdrop = event.target === event.currentTarget;
}
function onClick(event: MouseEvent): void {
  if (pressedBackdrop && event.target === event.currentTarget) close();
}
</script>

<!--
  ⌘K modal: search live agents and run app actions. A native `<dialog>`
  (top layer, focus trap, inert background); focus returns to where it was.
-->
<template>
  <dialog
    ref="dialog"
    class="glass dialog"
    aria-label="Search agents and actions"
    @keydown="onKeydown"
    @close="onClose"
    @mousedown="onMousedown"
    @click="onClick"
  >
    <PaletteBody v-if="open" @close="close" />
  </dialog>
</template>
```

- [ ] **Step 3: Split the shared stylesheet across the components**

`CommandPalette.module.css` is shared by four components; scoped styles must live with the elements they style. Line ranges (verified against the file): 1–26 dialog, 28–68 search/input/results, 70–82 heading/aside, 84–162 option…hint, 164–167 mark, 169–196 empty/footer, 198–209 `rise`/`fade` keyframes, 211–215 `urgent` keyframes.
```bash
P=src/ui/CommandPalette
css=$P/CommandPalette.module.css
scoped() { { printf '\n<style scoped>\n'; sed -n "$1" "$css"; printf '</style>\n'; } >> "$2"; }
scoped '1,26p;198,209p' $P/CommandPalette.vue
scoped '28,68p;169,196p' $P/PaletteBody.vue
scoped '70,82p' $P/PaletteSection.vue
scoped '84,162p;211,215p' $P/PaletteOption.vue
scoped '164,167p' $P/Highlight.vue
```
Check: `grep -c "^\." $P/*.vue` — every class used in a template has its rule in the same file (`grep -o 'class="[^"]*"' $P/PaletteOption.vue` lists `option dot main label sub tile hint`, all present in its style block).

- [ ] **Step 4: Type-check and test**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass. (The palette opens from the top bar's search trigger, added in Task 14, where it is checked.)

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCommandActions.ts src/ui/CommandPalette/*.vue src/ui/CommandPalette/paletteOption.ts
git commit -m "feat(vue): command palette

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Top bar

**Files:**
- Create: `src/ui/TopBar/TopBar.vue`, `Brand.vue`, `KpiStrip.vue`, `LiveIndicator.vue`, `SearchTrigger.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSnapshotStore`, `useAgentSource` (`kind`), `useModKey`, `MOD_KEY_LABEL`, `MOD_KEY_ARIA`, `IconButton`, `Kbd`, `CommandPalette` (`v-model:open`); `computeKpis` (`domain/kpis.ts`); `POLL_INTERVAL_MS` (`services/agentSource.ts`).

- [ ] **Step 1: Create the components**

Create `src/ui/TopBar/Brand.vue`:
```vue
<script setup lang="ts">
import { Building } from "@lucide/vue";

/** Product name exactly as in the approved design. */
const BRAND_NAME = "AgentCity";
</script>

<template>
  <div class="brand">
    <Building :size="24" :stroke-width="1.9" class="icon" aria-hidden="true" />
    <span class="name">{{ BRAND_NAME }}</span>
  </div>
</template>
```

Create `src/ui/TopBar/KpiStrip.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Bot, Coins, GitFork, Hand, type LucideIcon } from "@lucide/vue";
import { computeKpis } from "../../domain/kpis";
import { formatTokens } from "../../domain/format";
import { useSnapshotStore } from "../../stores/snapshot";

interface Kpi {
  label: string;
  value: string;
  Icon: LucideIcon;
  alert?: boolean;
}

const { snapshot } = storeToRefs(useSnapshotStore());
const kpis = computed(() => computeKpis(snapshot.value));
const items = computed<Kpi[]>(() => [
  { label: "Active agents", value: String(kpis.value.activeAgents), Icon: Bot },
  { label: "Subagents", value: String(kpis.value.subagents), Icon: GitFork },
  { label: "Tokens total", value: formatTokens(kpis.value.totalTokens), Icon: Coins },
  { label: "Awaiting you", value: String(kpis.value.awaiting), Icon: Hand, alert: true },
]);
</script>

<!-- Active agents · Subagents · Tokens · Awaiting you. -->
<template>
  <dl class="strip" aria-live="off">
    <div v-for="item in items" :key="item.label" class="kpi" :data-alert="item.alert && kpis.awaiting > 0">
      <span class="icon" :data-amber="item.alert">
        <component :is="item.Icon" :size="16" aria-hidden="true" />
      </span>
      <div class="text">
        <dt class="label">{{ item.label }}</dt>
        <dd class="value">{{ item.value }}</dd>
      </div>
    </div>
  </dl>
</template>
```

Create `src/ui/TopBar/LiveIndicator.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useTimestamp } from "@vueuse/core";
import { POLL_INTERVAL_MS } from "../../services/agentSource";
import { useAgentSource } from "../../composables/useAgentSource";
import { useSnapshotStore } from "../../stores/snapshot";

/** A snapshot older than this many poll intervals counts as stale. */
const STALE_AFTER = 3;

type Tone = "live" | "stale" | "error";

const source = useAgentSource();
const { snapshot, error } = storeToRefs(useSnapshotStore());
const now = useTimestamp({ interval: POLL_INTERVAL_MS });
const seconds = POLL_INTERVAL_MS / 1000;

const tone = computed<Tone>(() => {
  const stale = snapshot.value != null && now.value - snapshot.value.generatedAt > POLL_INTERVAL_MS * STALE_AFTER;
  return error.value && !snapshot.value ? "error" : stale ? "stale" : "live";
});
const text = computed(() =>
  tone.value === "error"
    ? "Backend unavailable"
    : tone.value === "stale"
      ? "Reconnecting…"
      : `${source.kind === "demo" ? "Demo data" : "Live"} · scanning ${seconds}s`,
);
</script>

<!-- "Live · scanning 2s" pill; turns amber when updates stop arriving. -->
<template>
  <div class="pill" :data-tone="tone" role="status">
    <span class="dot" aria-hidden="true" />{{ text }}
  </div>
</template>
```

Create `src/ui/TopBar/SearchTrigger.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { Search } from "@lucide/vue";
import { MOD_KEY_ARIA, MOD_KEY_LABEL, useModKey } from "../../composables/useModKey";
import CommandPalette from "../CommandPalette/CommandPalette.vue";
import Kbd from "../common/Kbd.vue";

const open = ref(false);
useModKey("k", () => (open.value = !open.value));
</script>

<!-- Search field look-alike in the top bar; click or ⌘K opens the command palette. -->
<template>
  <button
    type="button"
    class="glass trigger"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-keyshortcuts="`${MOD_KEY_ARIA}+K`"
    @click="open = true"
  >
    <Search :size="16" aria-hidden="true" />
    <span class="placeholder">Search agents &amp; actions</span>
    <Kbd>{{ MOD_KEY_LABEL }}K</Kbd>
  </button>
  <CommandPalette v-model:open="open" />
</template>
```

Create `src/ui/TopBar/TopBar.vue`:
```vue
<script setup lang="ts">
import { RefreshCw } from "@lucide/vue";
import { useSnapshotStore } from "../../stores/snapshot";
import IconButton from "../common/IconButton.vue";
import Brand from "./Brand.vue";
import KpiStrip from "./KpiStrip.vue";
import LiveIndicator from "./LiveIndicator.vue";
import SearchTrigger from "./SearchTrigger.vue";

const snapshots = useSnapshotStore();
</script>

<!-- Brand · KPIs · search (⌘K) · live status + refresh. -->
<template>
  <header class="bar">
    <Brand />
    <KpiStrip />
    <div class="right">
      <SearchTrigger />
      <LiveIndicator />
      <IconButton label="Refresh now" :size="48" @click="snapshots.refresh()">
        <RefreshCw :size="18" aria-hidden="true" />
      </IconButton>
    </div>
  </header>
</template>
```

Append the styles:
```bash
for c in Brand KpiStrip LiveIndicator SearchTrigger TopBar; do
  style_from src/ui/TopBar/$c.module.css src/ui/TopBar/$c.vue
done
```

- [ ] **Step 2: Add it to the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
import TopBar from "./ui/TopBar/TopBar.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <TopBar />
    <Hero />
    <CameraControls />
    <EmptyState />
    <RightColumn />
  </Overlay>
</template>
```

- [ ] **Step 3: Type-check, test, and compare**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

`$S/shot.sh t14-vue` and `$S/shot.sh t14-react`. Expected: identical top bar — brand, four KPIs (the "Awaiting you" tile amber when > 0), search trigger with `⌘K`, the live pill with its breathing dot, refresh button.

Ask the user to check the palette in the test window (Review Focus #5): ⌘K opens it with the input focused and agents + actions listed; typing filters with teal highlights; ↑/↓ moves the cursor and scrolls; Enter on an agent selects it and centres the camera; Enter on an action runs it; Escape closes the palette **and leaves the current house selected**; clicking the backdrop closes it; pressing ⌘K twice quickly (close → reopen) leaves it open; focus returns to the trigger after closing.

- [ ] **Step 4: Commit**

```bash
git add src/ui/TopBar/*.vue src/App.vue
git commit -m "feat(vue): top bar with KPIs, live indicator and ⌘K trigger

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Subagent strip

**Files:**
- Create: `src/ui/Subagents/SubagentStrip.vue`, `src/ui/Subagents/SubagentCard.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useSelectionStore` (`selectedSession`), `StatusPill`, `Elapsed`; `subagentCounts` (`domain/session.ts`); `displayProgress`, `progressFraction` (`domain/progress.ts`).

- [ ] **Step 1: Create the components**

Create `src/ui/Subagents/SubagentCard.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { Clock, Coins, Gauge } from "@lucide/vue";
import type { SubAgent } from "../../domain/types";
import { cssVar } from "../../domain/palette";
import { formatTokens } from "../../domain/format";
import { displayProgress, progressFraction } from "../../domain/progress";
import { statusMeta } from "../../domain/status";
import Elapsed from "../common/Elapsed.vue";
import StatusPill from "../common/StatusPill.vue";

const props = defineProps<{ agent: SubAgent }>();
const progress = computed(() => displayProgress(props.agent.progress));
const tooltip = computed(() => (props.agent.kind ? `${props.agent.title} (${props.agent.kind})` : props.agent.title));
</script>

<!-- Title + status pill, 4px progress bar in status colour, % · tokens · elapsed. -->
<template>
  <article class="card" :style="{ '--tint': cssVar(statusMeta(agent.status).color) }" :data-status="agent.status">
    <div class="top">
      <h3 class="title" :title="tooltip">{{ agent.title }}</h3>
      <StatusPill :status="agent.status" />
    </div>
    <div class="bar" aria-hidden="true">
      <span :style="{ width: `${progressFraction(agent.progress) * 100}%` }" />
    </div>
    <div class="meta">
      <span :title="`Progress: ${progress.caption}`"><Gauge :size="12" aria-hidden="true" />{{ progress.label }}</span>
      <span title="Tokens"><Coins :size="12" aria-hidden="true" />{{ formatTokens(agent.tokens.total) }}</span>
      <span title="Elapsed"><Clock :size="12" aria-hidden="true" /><Elapsed :item="agent" /></span>
    </div>
  </article>
</template>
```

Create `src/ui/Subagents/SubagentStrip.vue`:
```vue
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { GitFork } from "@lucide/vue";
import { subagentCounts } from "../../domain/session";
import { useSelectionStore } from "../../stores/selection";
import SubagentCard from "./SubagentCard.vue";

const { selectedSession } = storeToRefs(useSelectionStore());
const session = computed(() => {
  const selected = selectedSession.value?.session;
  return selected && selected.subagents.length > 0 ? selected : null;
});
const counts = computed(() => (session.value ? subagentCounts(session.value) : null));
</script>

<!-- Bottom strip listing the selected session's subagents (only when it has any). -->
<template>
  <section v-if="session && counts" class="glass strip" aria-label="Subagents">
    <header class="head">
      <h2 class="title"><GitFork :size="16" aria-hidden="true" />Subagents</h2>
      <p class="parent" :title="session.title">Spawned by <span>{{ session.title }}</span></p>
      <p class="counts">{{ counts.total }} total · {{ counts.running }} running</p>
    </header>
    <ul class="cards">
      <li v-for="agent in session.subagents" :key="agent.id" class="item">
        <SubagentCard :agent="agent" />
      </li>
    </ul>
  </section>
</template>
```

Append the styles; the two `svg` rules style Lucide icons rendered by child components, so they become `:deep()`:
```bash
style_from src/ui/Subagents/SubagentCard.module.css src/ui/Subagents/SubagentCard.vue
style_from src/ui/Subagents/SubagentStrip.module.css src/ui/Subagents/SubagentStrip.vue
sed -i '' 's/^\.meta svg {/.meta :deep(svg) {/' src/ui/Subagents/SubagentCard.vue
sed -i '' 's/^\.title svg {/.title :deep(svg) {/' src/ui/Subagents/SubagentStrip.vue
grep -n ":deep(svg)" src/ui/Subagents/*.vue
```
Expected: one `:deep(svg)` line in each file.

- [ ] **Step 2: Complete the app**

Replace `src/App.vue`:
```vue
<script setup lang="ts">
import CityCanvas from "./scene/CityCanvas.vue";
import CameraControls from "./ui/CameraControls.vue";
import EmptyState from "./ui/EmptyState.vue";
import Hero from "./ui/Hero/Hero.vue";
import Overlay from "./ui/Overlay.vue";
import RightColumn from "./ui/RightColumn.vue";
import SubagentStrip from "./ui/Subagents/SubagentStrip.vue";
import TopBar from "./ui/TopBar/TopBar.vue";
</script>

<!-- Composition only: 3D city behind, glass UI overlay in front. -->
<template>
  <CityCanvas />
  <Overlay>
    <TopBar />
    <Hero />
    <CameraControls />
    <EmptyState />
    <RightColumn />
    <SubagentStrip />
  </Overlay>
</template>
```

- [ ] **Step 3: Type-check, test, and compare**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run`
Expected: no type errors; all tests pass.

Ask the user to select a session that has subagents in the test window (or force demo data: the busy mock has sessions with subagents), then `$S/shot.sh t15-vue` / `$S/shot.sh t15-react` with the same session selected. Expected: the bottom strip with "Subagents", "Spawned by …", counts and the cards (title, status pill, progress bar, % · tokens · elapsed with icons aligned); the camera buttons move up to clear the strip (`--strip-space`).

- [ ] **Step 4: Commit**

```bash
git add src/ui/Subagents/SubagentStrip.vue src/ui/Subagents/SubagentCard.vue src/App.vue
git commit -m "feat(vue): subagent strip

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 16: Remove React

**Files:**
- Delete: every `src/**/*.tsx`, every `src/**/*.module.css`, `src/state/` (contexts, React hooks, `hoverStore.ts` + `hoverStore.test.ts`), `src/scene/cameraRig.ts`, `src/scene/useCameraRig.ts`, `src/scene/house/useDoneRipple.ts`, `src/scene/house/useHouseGlow.ts`, `src/scene/house/useHouseMotion.ts`, `src/ui/CommandPalette/useCommandActions.ts`
- Modify: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `src/domain/selection.ts:11-14` (comment), `README.md`, `.vscode/extensions.json`

**Interfaces:**
- Consumes: the complete Vue tree from Tasks 1–15 (nothing in it imports the files deleted here).

- [ ] **Step 1: Confirm nothing in the Vue tree still reaches into the React tree**

Run:
```bash
grep -rnE "from \"[^\"]*(\.tsx|\.module\.css|/state/|useCameraRig|scene/cameraRig|house/use(DoneRipple|HouseGlow|HouseMotion)|CommandPalette/useCommandActions)\"" src --include="*.vue" --include="*.ts" | grep -v "^src/state/" | grep -vE "\.tsx:" || echo "clean"
```
Expected: `clean`. (If any line prints, that Vue/TS file still imports a React-era module — fix the import to its Vue counterpart before deleting.)

- [ ] **Step 2: Delete the React tree**

```bash
git rm -q $(git ls-files 'src/*.tsx' 'src/**/*.tsx' 'src/**/*.module.css')
git rm -rq src/state
git rm -q src/scene/cameraRig.ts src/scene/useCameraRig.ts \
  src/scene/house/useDoneRipple.ts src/scene/house/useHouseGlow.ts src/scene/house/useHouseMotion.ts \
  src/ui/CommandPalette/useCommandActions.ts
git ls-files src | grep -E "\.tsx$|\.module\.css$|^src/state/" || echo "react tree gone"
```
Expected: `react tree gone`.

- [ ] **Step 3: Remove the React packages and the JSX setting**

```bash
pnpm remove react react-dom @react-three/fiber @react-three/drei @react-three/postprocessing lucide-react @vitejs/plugin-react @types/react @types/react-dom
```
In `tsconfig.json`, delete the line `"jsx": "react-jsx",` and change `include` to:
```json
  "include": ["src/**/*.ts", "src/**/*.vue"],
```

- [ ] **Step 4: Reword the React-era text**

In `src/domain/selection.ts`, replace the `reconcileSelection` doc comment:
```ts
/**
 * Keep a selection valid against a new snapshot. Returns the *same* object when
 * nothing changes, so consumers can skip work when the selection is unchanged.
 */
```

Replace the first three lines of `README.md`:
```markdown
# Tauri + Vue + TypeScript

This template should help get you started developing with Tauri, Vue and TypeScript in Vite.
```
and in its "Recommended IDE Setup" bullet, add the Vue extension after VS Code:
```markdown
- [VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
```

Replace `.vscode/extensions.json`:
```json
{
  "recommendations": ["Vue.volar", "tauri-apps.tauri-vscode", "rust-lang.rust-analyzer"]
}
```

- [ ] **Step 5: Verify React is gone and everything still builds**

Run:
```bash
grep -rniE "react|jsx" package.json tsconfig.json vite.config.ts index.html README.md .vscode src | grep -v "src/services/mock/mockSeed.ts" || echo "no react left"
```
Expected: `no react left`. (`mockSeed.ts` keeps its demo string "Wiring the snapshot event into the React city scene" — it is sample data shown in the demo city, not a reference to the framework; changing it is outside a straight port.)

Run: `pnpm build && pnpm vitest run`
Expected: `vue-tsc` clean, Vite `✓ built`; `Test Files  19 passed (19)`, `Tests  120 passed (120)` (102 original − 3 ported hover-store cases + 21 new).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove React

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Final verification — visual parity, behavior and the performance gate

**Files:** none changed (verification only). Results are reported to the user; nothing is merged.

- [ ] **Step 1: Visual parity on live data and on the demo city**

Announce the test window batch to the user. With this repo's dev server and the React reference worktree (Measurement Kit):
```bash
$S/shot.sh final-vue
pkill -f "argis/node_modules/.*vite/bin/vite.js"; (cd $S/argis-main && pnpm dev > $S/vite-main.log 2>&1 &); sleep 5
$S/shot.sh final-react
pkill -f "argis-main/node_modules/.*vite/bin/vite.js"; pnpm dev > $S/vite.log 2>&1 &
```
Repeat with demo data forced in both trees (`final-vue-mock`, `final-react-mock`), then revert the demo-data edits. Read each pair and compare: overall layout, every panel, the city (towers, houses, glow, shadows, lines, beacons), and three zoomed crops (one tower, one house cluster with labels, the agent panel). Expected: no differences beyond live data that changed between shots.

- [ ] **Step 2: Behavior checklist, with the user**

Ask the user to run `$S/target/debug/argis` and go through the spec's checklist, ticking each:
- [ ] Hover a house ↔ its agent-list row highlights (both directions)
- [ ] Click a house → selection, marker callout, agent panel; click ground deselects
- [ ] Click a tower / district row → camera focuses that district; again → whole city
- [ ] Escape peels house first, then district
- [ ] ⌘K palette: open, filter with highlight, every action runs
- [ ] Camera buttons: zoom in, zoom out, reset, fit
- [ ] Left-drag pans, right-drag rotates, wheel zooms to cursor; a drag is not a click
- [ ] House labels fade behind towers
- [ ] Done ripple on finish; awaiting beacon + pulse; running sparks + flow lines
- [ ] Live indicator: live / stale / error states; elapsed times tick
- [ ] Empty state with no sessions; subagent strip appears for sessions with subagents

Any unchecked item is a bug to fix (in the owning task's files) before continuing.

- [ ] **Step 3: Performance gate (production builds, visible window)**

Measure both production builds the same way — the test window is never focused, so both run their unfocused 15 fps path:
```bash
pkill -f "argis/node_modules/.*vite/bin/vite.js"
pnpm vite build && (npx vite preview --port 1420 --strictPort > $S/preview.log 2>&1 &); sleep 2
$S/measure-valid.sh gate-vue-1; $S/measure-valid.sh gate-vue-2
pkill -f "argis/node_modules/.*vite/bin/vite.js"
(cd $S/argis-main && pnpm vite build && (npx vite preview --port 1420 --strictPort > $S/preview-main.log 2>&1 &)); sleep 2
$S/measure-valid.sh gate-react-1; $S/measure-valid.sh gate-react-2
pkill -f "argis-main/node_modules/.*vite/bin/vite.js"
```
Expected: the Vue runs' `webcontent`, `gpu` and `ui-host` CPU are each within 2 percentage points of the React runs (or lower), and the Vue WebContent footprint is within 10 % of React's (or lower). Reference from the earlier React measurement with this method: WebContent ≈ 7 %, GPU ≈ 4 %, UI host ≈ 5 % CPU unfocused; footprint ≈ 268 MB. If Vue is worse beyond those margins, **stop and report the numbers** — do not merge.

- [ ] **Step 4: Clean up the measurement setup**

```bash
git worktree remove --force $S/argis-main
rm -rf $S/target
curl -s -o /dev/null -w "port 1420: %{http_code}\n" http://localhost:1420/
git status --short
```
Expected: `port 1420: 000` (free for the user's `pnpm tauri dev`), clean working tree.

- [ ] **Step 5: Report**

Report to the user: the commit list (`git log --oneline main..vue-migration`), the side-by-side screenshots, the checklist result, and the before/after performance table. The branch is ready to merge; merging into `main` happens only when the user says so.
