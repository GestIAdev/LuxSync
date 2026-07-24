import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ServiceLighting — Luz de Trabajo
// PROYECTO EREBUS FASE 2
//
// Cero skyboxes fotográficos. Iluminación fría y técnica:
//   - hemisphereLight (sky #2a303c / ground #14171f, intensity 0.4)
//   - directionalLight cenital (intensity 0.5, color frío)
//
// La hemisphereLight despega los objetos del negro puro sin
// lavar la escena — sky tint azulado, ground tint oscuro.
// ═══════════════════════════════════════════════════════════════════════════

export const ServiceLighting: React.FC = () => {
  return (
    <>
      {/* Hemisphere — sky/ground fill to lift objects off pure black */}
      <hemisphereLight args={['#2a303c', '#14171f', 0.4]} />

      {/* Directional — cold service light from above */}
      <directionalLight
        position={[5, 12, 5]}
        intensity={0.5}
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

      {/* Secondary fill from opposite side */}
      <directionalLight
        position={[-8, 6, -4]}
        intensity={0.15}
        color="#556677"
      />
    </>
  )
}

export default ServiceLighting
