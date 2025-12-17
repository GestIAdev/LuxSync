/**
 * 🎥 CAMERA CONTROLS 3D - WAVE 30
 * Wrapper para controles de cámara con presets
 */

import React from 'react'
import { OrbitControls } from '@react-three/drei'

export interface CameraControls3DProps {
  enabled?: boolean
}

export const CameraControls3D: React.FC<CameraControls3DProps> = ({
  enabled = true,
}) => {
  return (
    <OrbitControls
      enabled={enabled}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={5}
      maxDistance={30}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2 - 0.1}
      target={[0, 2, 0]}
    />
  )
}

export default CameraControls3D
