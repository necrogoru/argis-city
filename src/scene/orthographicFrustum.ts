import type { OrthographicCamera } from "three";

/**
 * One world unit per CSS pixel before zoom, centred on the view — what React
 * Three Fiber did for its default orthographic camera, and what `fitZoom` in
 * layout.ts assumes. TresJS only resizes perspective cameras.
 */
export function fitOrthographicFrustum(camera: OrthographicCamera, width: number, height: number): void {
  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;
  camera.updateProjectionMatrix();
}
