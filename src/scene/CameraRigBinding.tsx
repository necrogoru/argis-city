import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import type { ProviderId } from "../domain/types";
import type { CityModel } from "./cityModel";
import { MAX_ZOOM, MIN_ZOOM } from "./layout";
import { useCameraRig } from "./useCameraRig";

const { ACTION } = CameraControlsImpl;
// Map-like: left drag pans, right drag orbits, wheel zooms to the cursor.
const MOUSE = { left: ACTION.TRUCK, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM };
const TOUCH = { one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.NONE };

interface Props {
  city: CityModel;
  hasData: boolean;
  focusedProvider: ProviderId | null;
}

/** In-canvas half of the camera rig: owns CameraControls and reacts to focus. */
export function CameraRigBinding({ city, hasData, focusedProvider }: Props) {
  const rig = useCameraRig();
  const controls = useRef<CameraControlsImpl>(null);
  const size = useThree((s) => s.size);
  const framed = useRef(false);

  useEffect(() => {
    rig.attach(controls.current);
    return () => rig.attach(null);
  }, [rig]);

  useEffect(() => {
    rig.update({ width: size.width, height: size.height }, city);
  }, [rig, size.width, size.height, city]);

  // First real data: frame the city without animation.
  useEffect(() => {
    if (!hasData || framed.current) return;
    framed.current = true;
    rig.fit(false);
  }, [rig, hasData]);

  // District focus from the hero list / tower clicks; clearing it re-frames the city.
  useEffect(() => {
    if (!framed.current) return;
    if (focusedProvider) rig.focus(focusedProvider);
    else rig.fit();
  }, [rig, focusedProvider]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      minPolarAngle={0.55}
      maxPolarAngle={1.1}
      smoothTime={0.32}
      dollyToCursor
      mouseButtons={MOUSE}
      touches={TOUCH}
    />
  );
}
