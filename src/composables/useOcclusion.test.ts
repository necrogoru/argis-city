import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera } from "three";
import { isOccluded } from "./useOcclusion";

/** Iso-ish orthographic camera looking at the origin, as in the city. */
function camera(): OrthographicCamera {
  const cam = new OrthographicCamera(-20, 20, 12, -12, 0.1, 1000);
  cam.position.set(60, 60, 60);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

function point(x: number, y: number, z: number): Object3D {
  const o = new Object3D();
  o.position.set(x, y, z);
  return o;
}

const tower = () => new Mesh(new BoxGeometry(2, 8, 2), new MeshBasicMaterial());

describe("isOccluded", () => {
  it("is true when the tower stands between the camera and the label anchor", () => {
    // Behind the tower as seen from (60, 60, 60): further along -x/-z, low enough to be covered.
    expect(isOccluded(point(-3, 1, -3), camera(), [tower()])).toBe(true);
  });

  it("is false when the anchor is in front of the tower", () => {
    expect(isOccluded(point(3, 1, 3), camera(), [tower()])).toBe(false);
  });

  it("is false with no occluders", () => {
    expect(isOccluded(point(-3, 1, -3), camera(), [])).toBe(false);
  });
});
