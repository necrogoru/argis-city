import type { OrthographicCamera } from "three";
import type { CameraControls } from "@react-three/drei";
import type { ProviderId } from "../domain/types";
import type { CityModel } from "./cityModel";
import { districtFrame, fitZoom, type Frame, type Size } from "./layout";

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
 * The binding inside the Canvas attaches the controls and keeps view/city fresh.
 */
export class CameraRig {
  private controls: CameraControls | null = null;
  private view: Size = { width: 1440, height: 900 };
  private city: CityModel | null = null;

  attach(controls: CameraControls | null): void {
    this.controls = controls;
  }

  update(view: Size, city: CityModel): void {
    this.view = view;
    this.city = city;
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** Frame the whole city, keeping the current rotation. */
  fit(animate = true): void {
    if (!this.city) return;
    this.frameAt(0, 0, this.city.frame, animate);
  }

  /** Back to the default isometric angle, framing the whole city. */
  reset(): void {
    const c = this.controls;
    if (!c || !this.city) return;
    const y = this.city.frame.targetY;
    void c.setLookAt(ISO_OFFSET, y + ISO_OFFSET, ISO_OFFSET, 0, y, 0, true);
    void c.zoomTo(this.zoomFor(this.city.frame), true);
  }

  /** Centre and zoom onto one provider's district. */
  focus(provider: ProviderId): void {
    const district = this.city?.districts.find((d) => d.provider === provider);
    if (!district) return;
    this.frameAt(district.x, district.z, districtFrame(district.radius, district.height), true);
  }

  /** Centre on one session's house at district zoom (agent list row click). */
  focusSession(sessionId: string): void {
    for (const d of this.city?.districts ?? []) {
      const house = d.houses.find((h) => h.session.id === sessionId);
      if (!house) continue;
      const frame = districtFrame(d.radius, d.height);
      this.frameAt(d.x + house.x, d.z + house.z, { ...frame, targetY: HOUSE_TARGET_Y }, true);
      return;
    }
  }

  private frameAt(x: number, z: number, frame: Frame, animate: boolean): void {
    const c = this.controls;
    if (!c) return;
    void c.moveTo(x, frame.targetY, z, animate);
    void c.zoomTo(this.zoomFor(frame), animate);
  }

  private zoomFor(frame: Frame): number {
    return fitZoom(this.view, frame, overlayInsets(this.view));
  }

  private zoomBy(factor: number): void {
    const c = this.controls;
    if (!c) return;
    const zoom = (c.camera as OrthographicCamera).zoom;
    void c.zoomTo(zoom * factor, true);
  }
}
