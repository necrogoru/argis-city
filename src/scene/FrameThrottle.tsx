import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/** Ambient animation rate (glows, sparks, dashes) while the window is focused. */
const FOCUSED_FPS = 30;
/** …and while it sits unfocused beside other work, glanced at rather than used. */
const BACKGROUND_FPS = 15;
/** Fire the timer a little early so the frame lands on the vsync we want. */
const VSYNC_SLACK_MS = 4;

function frameDelay(focused: boolean): number {
  return 1000 / (focused ? FOCUSED_FPS : BACKGROUND_FPS) - VSYNC_SLACK_MS;
}

/**
 * Drives a `frameloop="demand"` canvas at a capped rate. In WKWebView every
 * presented WebGL frame carries a fixed cost (rendering update, GPU-process
 * handoff, layer-tree commit) regardless of scene size, so the frame rate is
 * what CPU use scales with. Ambient effects are slow enough to read the same
 * at 30 fps (15 in the background); camera moves and pointer interaction
 * still render immediately because CameraControls and prop changes invalidate.
 *
 * Each rendered frame schedules the next one with a timer rather than a rAF
 * loop: a rAF callback every vsync would force WebKit through a full
 * rendering update 60×/s even while the canvas is idle.
 */
export function FrameThrottle() {
  const invalidate = useThree((s) => s.invalidate);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const delay = useRef(frameDelay(document.hasFocus()));

  useFrame(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => invalidate(), delay.current);
  });

  useEffect(() => {
    const onFocus = () => {
      delay.current = frameDelay(true);
      invalidate();
    };
    const onBlur = () => {
      delay.current = frameDelay(false);
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    invalidate();
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      clearTimeout(timer.current);
    };
  }, [invalidate]);

  return null;
}
