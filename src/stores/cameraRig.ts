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
