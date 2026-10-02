const SHADOW_EXTENT = 26;

/** Low ambient fill + one cool key light casting soft shadows across the city. */
export function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#2A3A3C", "#050606", 0.6]} />
      <directionalLight
        position={[-12, 22, 9]}
        intensity={1.4}
        color="#DCEBFF"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
      {/* Faint teal bounce from the city centre. */}
      <directionalLight position={[10, 6, 12]} intensity={0.25} color="#32F3E2" />
    </>
  );
}
