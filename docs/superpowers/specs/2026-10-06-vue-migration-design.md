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
3. `vue-tsc --noEmit` is clean; 12 existing test files pass unchanged (the
   hover-store test is ported, see Verification); new store/composable tests
   pass.
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
| Overlays | native `<dialog>` + `showModal()` (top layer) | unchanged — the ⌘K palette stays a native modal dialog, so no `<Teleport>` is needed |
| 3D | `@react-three/fiber`, `drei`, `@react-three/postprocessing` | `@tresjs/core`, `@tresjs/cientos` (`Html`, `Grid`, `CameraControls`); post-processing via a `useEffectComposer` composable on `postprocessing`; connection lines via `SegmentLines.vue` on three's `LineSegments2` |
| File layout | hooks and contexts under `state/`, `scene/`, `ui/` | Pinia stores in `src/stores/`, composables in `src/composables/` |
| Icons | `lucide-react` | `@lucide/vue` |
| Build / types | `@vitejs/plugin-react`, `tsc` | `@vitejs/plugin-vue` (+ TresJS template compiler options), `vue-tsc` |

**Removed packages:** `react`, `react-dom`, `@react-three/fiber`,
`@react-three/drei`, `@react-three/postprocessing`, `lucide-react`,
`@vitejs/plugin-react`, `@types/react`, `@types/react-dom`.
**Added:** `vue`, `pinia`, `@vueuse/core`, `@tresjs/core`, `@tresjs/cientos`,
`@lucide/vue`, `postprocessing` (previously only a transitive dependency of
`@react-three/postprocessing`; now imported directly), `@vitejs/plugin-vue`,
`vue-tsc`.
**Kept:** `three`, `@tauri-apps/*`, `vite`, `vitest`, `typescript`.

**Not used: `@tresjs/post-processing`.** Each of its effect components adds its
own `EffectPass`, so FXAA + Bloom would cost two full-screen passes and an extra
full-resolution buffer, where today both are merged into one pass. A ~30-line
`useEffectComposer()` composable builds the same merged pass on `postprocessing`
directly and hands it to TresJS via `useLoop().render()`.

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
| drei `Html` (`portal`, `zIndexRange`, `occlude`, `onOcclude`) | cientos `Html` (`portal`, `zIndexRange`) **without** `occlude` — cientos always hides an occluded label (`display: none`), whereas today labels fade to 30 %; a `useOcclusion()` composable runs drei's raycast test and drives `data-occluded` |
| drei `Line` with `segments` (base lines + dashed flow line) | `SegmentLines.vue` on three's `LineSegments2` / `LineSegmentsGeometry` / `LineMaterial` (what drei used) — cientos `Line2` has no `segments` mode and would join the house → tower pairs into one polyline, double-drawing segments with dashes running the wrong way |
| drei `Grid` | cientos `Grid`, identical props |
| drei `CameraControls` | cientos `CameraControls` (`make-default`, `min-zoom`/`max-zoom`, polar limits, `smooth-time`, `dolly-to-cursor`, same `mouseButtons`/`touches` from `camera-controls` `ACTION`) |
| drei `useCursor` | `useCursor(hovered)` composable — `watch` setting `document.body.style.cursor`, reset on unmount |
| `EffectComposer multisampling={0}` + `FXAA` + `Bloom` | `useEffectComposer()`: `EffectComposer({ multisampling: 0, frameBufferType: HalfFloatType })` + `RenderPass` + one `EffectPass(camera, FXAAEffect, BloomEffect)` (same props), installed with `useLoop().render()` |
| `onClick` / `onPointerOver` / `onPointerOut`, `event.delta` | `@pointerover` / `@pointerout` unchanged; clicks via a `usePressClick()` composable (`@pointerdown` + `@pointerup`): in `@pmndrs/pointer-events` (TresJS's event layer) `delta` throws "not supported" and `click` only fires if released within 300 ms, so the composable restores React Three Fiber's semantics — any press duration, rejected when the pointer travelled more than the 6 px `CLICK_TOLERANCE_PX` |

Shared geometries and materials remain module-level singletons from
`geometries.ts` / `materials.ts`, bound with `:geometry` / `:material`.

**Frame-rate policy — `useFrameRate()`** replaces `FrameThrottle` and feeds
`:fps-limit`:

- camera moving → no limit (display rate);
- otherwise window focused → 30 fps; unfocused → 15 fps.

"Moving" is set by any camera-controls activity event (`controlstart`,
`control`, `transitionstart`, `update`, `wake`) and cleared 150 ms after the
last one — this covers drags, damping and animated transitions, and also a
press that never moves the camera (where `sleep` would never fire). Focus comes
from VueUse `useWindowFocus()`. `CameraRigBinding` is mounted before the city
so the controls update ahead of the label projections each frame (drei ran it
at priority −1 for the same reason). The policy itself is a pure function
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
2. **Labels.** The stable label-layer portal must match today, including the
   remount race documented in `LabelLayer.tsx`. (Occlusion is handled by
   `useOcclusion`, see above.)
3. **Pointer travel.** Resolved while planning: `@pmndrs/pointer-events`'
   `delta` is unsupported and its `click` is time-gated (300 ms); see
   `usePressClick` above. The spike still checks a slow click and a short drag
   on a house by hand.
4. **Composer.** `useEffectComposer` renders exactly once per loop tick with
   FXAA ahead of Bloom in a single pass — verified by screenshot parity.

## Verification

**Automated**

- `vue-tsc --noEmit` clean; `vitest run` — 12 of the 13 existing test files
  unchanged and green. The 13th, `state/hoverStore.test.ts`, tests the React-era
  store factory; its cases move to the Pinia hover store's test, and it is
  deleted with the factory.
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
