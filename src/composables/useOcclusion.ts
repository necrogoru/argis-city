import { ref, type Ref, type ShallowRef } from "vue";
import { useLoop } from "@tresjs/core";
import { Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";

const raycaster = new Raycaster();
const anchor = new Vector3();
const projected = new Vector3();
const ndc = new Vector2();

/** True when one of `occluders` stands between the camera and `object` (drei Html's raycast test). */
export function isOccluded(object: Object3D, camera: Camera, occluders: readonly Object3D[]): boolean {
  if (occluders.length === 0) return false;
  camera.updateMatrixWorld();
  object.updateWorldMatrix(true, false);
  anchor.setFromMatrixPosition(object.matrixWorld);
  projected.copy(anchor).project(camera);
  raycaster.setFromCamera(ndc.set(projected.x, projected.y), camera);
  const hit = raycaster.intersectObjects(occluders as Object3D[], true)[0];
  return hit != null && hit.distance < anchor.distanceTo(raycaster.ray.origin);
}

/**
 * Reactive `isOccluded` for a label anchor, re-checked every rendered frame.
 * Labels fade (not hide) while occluded; cientos' Html would hide them, so
 * labels use this instead of its `occlude` prop.
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
    const next = isOccluded(object, cam, occluders().filter((o): o is Object3D => o != null));
    if (next !== occluded.value) occluded.value = next;
  });
  return occluded;
}
