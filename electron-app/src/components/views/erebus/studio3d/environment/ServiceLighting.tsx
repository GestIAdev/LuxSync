import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ServiceLighting — Luz de Trabajo
// PROYECTO EREBUS FASE 2
//
// Cero skyboxes fotográficos. Iluminación fría y técnica:
//   - directionalLight cenital (intensity 0.35, color frío)
//   - ambientLight (intensity 0.15, color neutro frío)
//
// En modo calibrate (futuro Fase 3): la luz baja al 40%.
// Por ahora, iluminación base fija.
// ═══════════════════════════════════════════════════════════════════════════

export const ServiceLighting: React.FC = () => {
  return (
    <>
      {/* Ambient — cold neutral fill */}
      <ambientLight intensity={0.15} color="#3a3a4a" />

      {/* Directional — cold service light from above */}
      <directionalLight
        position={[5, 12, 5]}
        intensity={0.35}
        color="#aabbcc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Secondary fill from opposite side — very dim */}
      <directionalLight
        position={[-8, 6, -4]}
        intensity={0.08}
        color="#556677"
      />
    </>
  )
}

export default ServiceLighting
