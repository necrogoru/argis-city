# Performance

Argis sits open all day next to the user's real work, so idle CPU is a product
feature. This file covers what drives the cost, the rules that protect it, and
how to measure it without fooling yourself.

## What drives the cost

In WKWebView every presented WebGL frame carries a fixed cost: a rendering
update in the page, a handoff to the GPU process, and a layer-tree commit to
the UI process. Scene size barely matters (removing bloom or shadows barely
moved WebContent CPU), while frame rate scales everything at roughly 0.65 %
total CPU per fps. **To save CPU, render fewer frames. Don't strip the scene.**

## Rules

### Render loop

- `scene/frameRate.ts` → `fpsLimitFor({ moving, focused })` sets the policy:
  uncapped while the camera moves, 30 fps when the window is focused, 15 fps
  when it isn't. It is a pure function with tests.
- `scene/frameDriver.ts` + `scene/FrameDriver.vue` park the TresJS loop after
  each frame and restart it with a timer when the next frame is due. Don't use
  TresJS's own `fps-limit` for this: it still requests an animation frame every
  vsync and skips most of them, and each wake-up costs a rendering update.
- Input renders at the next vsync rather than when the timer fires: a canvas
  press, enter or leave, a pointer move onto a *different* object
  (`onTargetChange`), a hover or selection change, or a resize all call
  `driver.wake()`. A new interaction that changes what's on screen needs the
  same wake, or it will show up late.
- `patches/@tresjs__core@5.9.2.patch` removes TresJS's always-on devtools
  bridge (two rAF loops that roughly tripled the idle CPU floor) and processes
  pointer events immediately instead of batching them to the next frame, which
  the parked loop would delay. `src/scene/tresPatch.test.ts` guards both.

### Reactivity

- `snapshot` is a `shallowRef`, replaced whole every 2 s. Derived data
  (`buildCity`, KPIs, lists) is `computed`.
- three.js objects, materials, geometries and the camera-controls instance are
  never reactive. Use `markRaw`, `shallowRef` or module scope.
  Geometries and materials are module-level singletons in
  `scene/geometries.ts` / `scene/materials.ts`.
- Per-frame animation mutates three.js objects inside
  `useLoop().onBeforeRender`. Nothing reactive changes per frame.
- Hover is a single `hoveredId`. Consumers compare against it in a `computed`,
  so a hover change re-renders only the two components whose answer flips.

### CSS

- Infinite animations animate only `opacity` and `transform`. An infinite
  `box-shadow` animation inside a `backdrop-filter` panel measured about 10 %
  CPU across processes while the canvas sat idle.
- Glass panels (`backdrop-filter`) are expensive to repaint. Don't animate
  anything behind or inside them that forces a repaint every frame.
- Clocks tick once a second through the shared `useNow()`. Don't add
  per-component intervals.

### Backend

- The poller collects every 2 s. Transcripts can be tens of MB, so read them
  through `JsonlTailCache` (only the appended bytes). The OpenCode model catalog
  (about 5 MB) is parsed once and re-read only when it changes.
- `cargo run --example dump_snapshot` prints cold and warm collect times. Warm
  collects should stay cheap, so check them after provider changes.

## Measuring

The trap: **macOS stops rendering windows that are fully covered.** If Argis
sits behind a full-screen terminal or browser, it renders nothing and reads
about 1–3 % CPU, which is a meaningless number. Trust only samples taken while
the window is verifiably frontmost for the whole sample.

Method (see `.agents/prompts/perf-check.md` for the step-by-step):

1. Measure the **production** build (`pnpm tauri build`), never `tauri dev`.
2. Build a test copy with `alwaysOnTop: true` into a scratch `CARGO_TARGET_DIR`,
   so the window stays frontmost and the real build stays untouched.
   **Tell the user before the window pops up.** It covers their screen for
   about 30 s per batch.
3. Confirm the z-order during sampling (CGWindowList) and discard any sample
   where the window wasn't on top.
4. Sample the three processes separately, focused and unfocused:
   `com.apple.WebKit.WebContent`, `com.apple.WebKit.GPU`, and the `argis`
   host process. Record the WebContent memory footprint too.

Baseline from the Vue migration (production build, visible window):

| | WebContent | GPU | UI host |
| --- | --- | --- | --- |
| Focused CPU | ≈ 10 % | ≈ 7 % | ≈ 7 % |
| Unfocused CPU | ≈ 7 % | ≈ 4 % | ≈ 5 % |

WebContent footprint ≈ 268 MB. A change should land within run-to-run noise
of these numbers or below them.
