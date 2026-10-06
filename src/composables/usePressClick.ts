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
