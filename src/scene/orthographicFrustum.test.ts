import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { fitOrthographicFrustum } from "./orthographicFrustum";

describe("fitOrthographicFrustum", () => {
  it("spans one world unit per CSS pixel before zoom, centred on the view", () => {
    const camera = new OrthographicCamera();
    fitOrthographicFrustum(camera, 1440, 900);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-720, 720, 450, -450]);
  });

  it("updates the projection, so a point 100 px right of centre lands where expected", () => {
    const camera = new OrthographicCamera();
    camera.zoom = 2;
    fitOrthographicFrustum(camera, 1000, 500);
    const ndc = new Vector3(100, 0, -1).project(camera);
    expect(ndc.x).toBeCloseTo((100 * 2) / 500); // 100 world units × zoom 2 = 200 px of a 500 px half-width
  });
});
