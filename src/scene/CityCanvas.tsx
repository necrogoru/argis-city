import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { PALETTE } from "../domain/palette";
import { useSnapshot } from "../state/SnapshotContext";
import { useSelection } from "../state/SelectionContext";
import { buildCity } from "./cityModel";
import { CityScene } from "./CityScene";
import { CameraRigBinding } from "./CameraRigBinding";
import { Effects } from "./Effects";
import { FrameThrottle } from "./FrameThrottle";
import { LabelLayerContext } from "./LabelLayer";
import { Lights } from "./Lights";
import styles from "./CityCanvas.module.css";

const CAMERA = { position: [60, 60, 60] as [number, number, number], zoom: 22, near: 0.1, far: 1000 };
/**
 * The EffectComposer renders the scene into its own buffer (with its own
 * depth), so the canvas only receives the final full-screen pass: it needs no
 * depth buffer, and an opaque canvas is cheaper for the compositor to blend.
 */
const GL = { antialias: false, alpha: false, depth: false };
/**
 * Capped below Retina 2×: under bloom + FXAA it reads almost the same, and
 * every full-screen buffer (canvas, composer, bloom) shrinks by ~44% — about
 * 100 MB less GPU memory.
 */
const DPR: [number, number] = [1, 1.5];

/** Full-bleed isometric WebGL city behind the UI overlay. */
export function CityCanvas() {
  const { snapshot } = useSnapshot();
  const { selection } = useSelection();
  const city = useMemo(() => buildCity(snapshot), [snapshot]);
  const labels = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.layer}>
      <LabelLayerContext.Provider value={labels}>
        <Canvas
          orthographic
          frameloop="demand"
          shadows="percentage"
          dpr={DPR}
          camera={CAMERA}
          gl={GL}
        >
          <FrameThrottle />
          <color attach="background" args={[PALETTE.bg]} />
          <fog attach="fog" args={[PALETTE.bg, 110, 175]} />
          <Lights />
          <CityScene city={city} />
          <CameraRigBinding city={city} hasData={snapshot != null} focusedProvider={selection.provider} />
          <Effects />
        </Canvas>
      </LabelLayerContext.Provider>
      <div ref={labels} className={styles.labels} />
    </div>
  );
}
