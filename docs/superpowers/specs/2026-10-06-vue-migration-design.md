# Vue migration — design

**Date:** 2026-10-06 · **Branch:** `vue-migration` · **Status:** approved design, awaiting spec review

## Goal

Replace React with Vue across the Argis frontend as a **straight port**: identical
look and behavior, same performance or better, no React left in the project.
The app should read as a Vue app — Vue-native tools and idioms throughout, not
React patterns translated into Vue syntax.

**Success criteria**

1. Side-by-side screenshots of `main` (React) and `vue-migration` (Vue) match.
2. Every item in the behavior checklist (below) works as it does today.
3. `vue-tsc --noEmit` is clean; the existing 13 test files pass unchanged; new
   store/composable tests pass.
4. Production-build CPU and memory are within run-to-run noise of today's React
   numbers or better (see Performance gate).
5. `package.json` contains no React packages.

**Non-goals:** UI or behavior changes, new features, redesign, Rust backend
changes, Tauri config changes. Any of these is separate follow-up work.

## Stack decisions

| Concern | Was | Becomes |
|---|---|---|
| Components | `.tsx` function components | `.vue` SFCs, `<script setup lang="ts">` |
| Styles | 35 `*.module.css` files | `<style scoped>` in each SFC (rules moved verbatim); `styles/tokens.css` and `styles/base.css` stay global |
| App state | 5 React contexts, a hand-rolled `useSyncExternalStore` hover store | **Pinia** setup stores |
| Dependency injection | `AgentSourceContext` | `app.provide(agentSourceKey, source)` + `inject` |
| Reusable logic | React hooks, a `CameraRig` class, a hover-store factory | Vue composables (`useXxx`) built on the Composition API; Vue 3.5 built-ins (`useTemplateRef`, `useId`) where applicable |
| Utilities | manual `addEventListener` / `setInterval` | **VueUse** (`useNow`, `useIntervalFn`, `onKeyStroke`, `useEventListener`, `useWindowFocus`, `createSharedComposable`) |
| Panel content kept during fade-out | `useRetained` hook | a `watch` that remembers the last selected session (both slots stay mounted and crossfade with CSS, as today) |
| Overlays | portals | `<Teleport to="body">` |
| 3D | `@react-three/fiber`, `drei`, `@react-three/postprocessing` | `@tresjs/core`, `@tresjs/cientos`, `@tresjs/post-processing` |
| Icons | `lucide-react` | `@lucide/vue` |
| Build / types | `@vitejs/plugin-react`, `tsc` | `@vitejs/plugin-vue` (+ TresJS template compiler options), `vue-tsc` |

**Removed packages:** `react`, `react-dom`, `@react-three/fiber`,
`@react-three/drei`, `@react-three/postprocessing`, `lucide-react`,
`@vitejs/plugin-react`, `@types/react`, `@types/react-dom`.
**Added:** `vue`, `pinia`, `@vueuse/core`, `@tresjs/core`, `@tresjs/cientos`,
`@tresjs/post-processing`, `@lucide/vue`, `@vitejs/plugin-vue`, `vue-tsc`.
**Kept:** `three`, `postprocessing` (used by TresJS's composer too),
`@tauri-apps/*`, `vite`, `vitest`, `typescript`.

## What stays, what is rewritten

**Unchanged (framework-free code and its tests):** `src/domain/**`,
`src/services/**`, and the pure scene modules `scene/layout.ts`,
`scene/cityModel.ts`, `scene/connectionModel.ts`, `scene/geometries.ts`,
`scene/materials.ts`. Comments that mention React in these files (e.g.
`reconcileSelection`'s "so React can bail out") are reworded; logic is not
touched.

**Rewritten 1:1 — same names, same folders** (`Foo.tsx` + `Foo.module.css` →
`Foo.vue`):

| Folder | Components |
|---|---|
| root | `App`, `main.tsx` → `main.ts`; `AppProviders` is removed (Pinia + `provide` in `main.ts`) |
| `scene/` | `CityCanvas`, `CityScene`, `CameraRigBinding`, `ConnectionLines`, `District`, `Effects`, `Ground`, `Lights`, `Tower`, `TowerLabel`; `LabelLayer` → provide/inject of the label-layer element; `CameraRigContext` + `cameraRig.ts` + `useCameraRig.ts` → `useCameraRigStore`; `FrameThrottle` → `useFrameRate` |
| `scene/house/` | `House`, `HouseShell`, `HouseBeacon`, `HouseLabel`, `HouseMarker`, `AlertBeacon`, `DoneHalo`, `GroundPulse`, `RoofSparks`; hooks `useHouseGlow`, `useHouseMotion`, `useDoneRipple` → composables |
| `state/` | contexts → stores (below); `useNow`, `useEscapeKey`, `useModKey`, `useSelectedSession`, `useSnapshotFeed` → composables/store members; `useRetained` → a `watch` inside `RightColumn.vue` (its only caller) |
| `ui/` | `CameraControls`, `EmptyState`, `Overlay`, `RightColumn` |
| `ui/AgentList/` | `AgentList`, `AgentGroup`, `AgentRow`, `StatusChips` |
| `ui/AgentPanel/` | `AgentPanel`, `ContextBar`, `MetaRows`, `PanelActions`, `PanelHeader`, `PanelStats`, `ProgressRing`, `ProgressSection`, `StatTile` |
| `ui/CommandPalette/` | `CommandPalette`, `Highlight`, `PaletteOption`; `useCommandActions` → composable returning a `computed` list |
| `ui/common/` | `Elapsed`, `IconButton`, `Kbd`, `StatusIcon`, `StatusPill`, `Swatch` |
| `ui/Hero/` | `Hero`, `HeroHeading`, `DistrictList` |
| `ui/Subagents/` | `SubagentStrip`, `SubagentCard` |
| `ui/TopBar/` | `TopBar`, `Brand`, `KpiStrip`, `LiveIndicator`, `SearchTrigger` |

## State and data flow

```
Rust poller ── "agents://snapshot" every 2 s ──► AgentSource (interface unchanged)
                                                  app.provide(agentSourceKey, source)
                                                        │ inject
                                                        ▼
useSnapshotStore ──► useSelectionStore ──► components
                     useHoverStore, useCameraRigStore
```

- **`main.ts`** creates the app, installs Pinia, and provides the AgentSource
  chosen by `createAgentSource()` (Tauri inside the app, mock in a browser or
  with `?mock`).
- **`useSnapshotStore`** — `snapshot: shallowRef<Snapshot | null>`,
  `error: ref<string | null>`, `refresh()`. Subscribes to the source when the
  store is created and fetches the initial snapshot; keeps today's `accept()`
  rule (an older snapshot never replaces a newer one).
- **`useSelectionStore`** — `raw` selection ref; `selection` computed as
  `reconcileSelection(raw, snapshot)` with a `watch` that persists the
  reconciled value (a vanished house never comes back); `selectedSession`
  computed via `findSelected` (replaces `useSelectedSession`); actions
  `selectSession`, `clearSession`, `focusProvider`, `toggleProvider` delegating
  to `domain/selection.ts`; `onKeyStroke('Escape')` applies `escapeSelection`
  unless the event was already handled (`defaultPrevented`).
- **`useHoverStore`** — `hoveredId` ref, `set(id)`, `clear(id)` (clears only if
  `id` is still the hovered one). Consumers use
  `computed(() => hover.hoveredId === id)`; Vue's dependency tracking re-renders
  only the two affected components, as the React store did by hand.
- **`useCameraRigStore`** — the `CameraRig` class as a store: `controls`
  (`shallowRef`, raw camera-controls instance), `view` size, `city`; actions
  `attach`, `update`, `zoomIn`, `zoomOut`, `fit`, `reset`, `focus`,
  `focusSession`. Framing math stays in `layout.ts`.
- **Label layer** — `CityCanvas` owns the label-layer `<div>` via
  `useTemplateRef` and `provide`s it; label components `inject` it for the
  `Html` `portal` prop. Tree-scoped DOM, so provide/inject rather than Pinia.

**Composables**

- `useNow()` — one shared 1 s clock (`createSharedComposable` around VueUse
  `useNow({ interval: 1000 })`); `LiveIndicator` uses its own 2 s interval.
- `useModKey(key, handler)` — `onKeyStroke` with the ⌘/Ctrl, no-Alt, no-Shift,
  no-repeat rules of today; `MOD_KEY_LABEL` / `MOD_KEY_ARIA` constants unchanged.
- `useCommandActions()` — `computed<CommandAction[]>`, same actions and order.
- `RightColumn.vue` keeps both slots mounted with the same `data-active` /
  `inert` crossfade; `shown` is a ref updated by
  `watch(selectedSession, (s) => { if (s) shown.value = s })`, and keyboard
  focus follows the visible slot via a `flush: 'post'` watch on `open` with
  `useTemplateRef` slot refs.
- `useHouseGlow`, `useHouseMotion`, `useDoneRipple`, `useFrameRate`, `useCursor`
  — see the scene section.

**Errors** — unchanged semantics: snapshot failures set `error`; `open_path`
failures are logged with the `[argis]` prefix.

## The 3D city (TresJS)

| React | Vue / TresJS |
|---|---|
| `<Canvas orthographic dpr gl shadows camera>` | `<TresCanvas :dpr="[1, 1.5]" :antialias="false" :alpha="false" :depth="false" shadows :shadow-map-type="PCFShadowMap" :clear-color="PALETTE.bg" :fps-limit="fpsLimit">` + `<TresOrthographicCamera>` (same position/zoom/near/far) |
| `<color attach="background">`, `<fog attach="fog">` | `clear-color` prop, `<TresFog attach="fog" :args>` |
| `useFrame((state, delta) => …)` | `useLoop().onBeforeRender(({ delta, elapsed }) => …)` |
| drei `Html` (`portal`, `zIndexRange`, `occlude`, `onOcclude`) | cientos `Html`, same props, `@on-occlude` |
| drei `Line` (base lines + dashed flow line) | cientos `Line2` (`vertexColors`, `dashed`, `dashSize`, `gapSize`; flow line advances `material.dashOffset` in the loop) |
| drei `Grid` | cientos `Grid`, identical props |
| drei `CameraControls` | cientos `CameraControls` (`make-default`, `min-zoom`/`max-zoom`, polar limits, `smooth-time`, `dolly-to-cursor`, same `mouseButtons`/`touches` from `camera-controls` `ACTION`) |
| drei `useCursor` | `useCursor(hovered)` composable — `watch` setting `document.body.style.cursor`, reset on unmount |
| `EffectComposer multisampling={0}` + `FXAA` + `Bloom` | `EffectComposerPmndrs :multisampling="0"` + `FXAAPmndrs` (first) + `BloomPmndrs` (same props) |
| `onClick` / `onPointerOver` / `onPointerOut`, `event.delta` | `@click` / `@pointerover` / `@pointerout` (`@pmndrs/pointer-events`: `delta`, `stopPropagation()`); 6 px `CLICK_TOLERANCE_PX` rule unchanged |

Shared geometries and materials remain module-level singletons from
`geometries.ts` / `materials.ts`, bound with `:geometry` / `:material`.

**Frame-rate policy — `useFrameRate()`** replaces `FrameThrottle` and feeds
`:fps-limit`:

- camera moving → no limit (display rate);
- otherwise window focused → 30 fps; unfocused → 15 fps.

"Moving" tracks camera-controls `wake` / `sleep` on the controls instance
(covers drags, damping and animated transitions); focus comes from VueUse
`useWindowFocus()`. The policy itself is a pure function
`fpsLimitFor({ moving, focused })` so it is unit-tested without a canvas.

**Reactivity rules (protect the performance work)**

- `snapshot` is a `shallowRef`, replaced whole every 2 s, never deep-proxied;
  derived data (`buildCity(snapshot)`, KPIs, lists) is `computed`.
- three.js objects, materials, geometries and the camera-controls instance are
  never reactive (`markRaw` / `shallowRef` / module scope).
- Per-frame animation mutates three.js objects inside `onBeforeRender`; no
  reactive state changes per frame.
- The opacity-only CSS animations (`breathe`, `urgent`) move into scoped styles
  unchanged.

## Risks — checked first, in a spike

1. **Idle rAF wake-ups.** TresJS's loop (VueUse `useRafFn` with `fpsLimit`)
   requests a frame every vsync even when it skips the callback. Measure against
   today's numbers; if it costs measurably, stop the TresJS loop and drive frames
   from a timer, as `FrameThrottle` does today.
2. **Labels.** cientos `Html` occlusion (fade behind the tower) and the stable
   label-layer portal must match today, including the remount race documented in
   `LabelLayer.tsx`.
3. **Pointer travel.** Confirm `@pmndrs/pointer-events` `delta` is the pixel
   distance since pointer-down (React Three Fiber semantics); if not, track it
   from `pointerdown` on the canvas.
4. **Composer.** `EffectComposerPmndrs` renders exactly once per loop tick, with
   FXAA ahead of Bloom.

## Verification

**Automated**

- `vue-tsc --noEmit` clean; `vitest run` — the 13 existing test files unchanged
  and green.
- New Vitest tests (no DOM): snapshot store ordering (`accept()`), selection
  reconciliation persistence, Escape peeling (house → district), hover
  set/clear race guard, `fpsLimitFor` (30 / 15 / unlimited).

**Visual parity** — screenshots of the React build (`main`) and the Vue build
in the same 1440×900 window: full view plus zoomed crops of towers, houses,
labels and glow. Also the in-browser mock data (`?mock`, `?mock=empty`) for the
busy and empty cities.

**Behavior checklist** (manual; there are no e2e tests)

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

**Performance gate** — production build, measured with the visible-window
method (window verified frontmost for the whole sample), within run-to-run
noise of today's React numbers or better: WebContent ≈ 10 %, GPU process ≈ 7 %,
UI host ≈ 7 % CPU focused (≈ 7 / 4 / 5 % unfocused); WebContent footprint
≈ 268 MB.

The visual and performance checks use the always-on-top test build; it pops up
for ~30 s at a time, only during those steps, announced before each batch.

## Rollout

1. Toolchain swap; stores and composables (+ their tests).
2. Risk spike: canvas, one tower, one house with label, composer, `useFrameRate`;
   resolve the four risks with measurements.
3. Port the rest of the city.
4. Port the DOM UI.
5. Remove React packages; update `README.md` and any docs that mention React.
6. Verification (all sections above); merge to `main` only when everything
   passes. `main` stays untouched until then, so rollback is not merging.
