import React, { useMemo, useRef } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// ═══════════════════════════════════════════════════════════════════════════
// StudioFloor — El Suelo de Estudio
// PROYECTO EREBUS FASE 2
//
// Plano grande (40m × 40m) con MeshReflectorMaterial:
//   mirror = 0.07 (7% specular reflection)
//   blur = [400, 100] (soft reflection)
//   resolution = 512 (LQ-safe)
//   color base = --obs-floor (#14171F)
//
// Rejilla custom: NO gridHelper. Shader de micro-surco con fwidth,
// líneas cada 0.25m, visibles solo en ángulos rasantes.
// ═══════════════════════════════════════════════════════════════════════════

interface StudioFloorProps {
  quality?: 'HQ' | 'LQ'
}

const FLOOR_SIZE = 40
const FLOOR_COLOR = '#14171F'
const GRID_SPACING = 0.25 // meters
const GRID_COLOR = '#2A3040' // --obs-line

// ═══════════════════════════════════════════════════════════════════════════
// Grid Shader — micro-surco via fwidth
// Lines appear as subtle grooves, visible at grazing angles
// ═══════════════════════════════════════════════════════════════════════════

const gridVertexShader = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const gridFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vWorldPos;
  uniform float uSpacing;
  uniform vec3 uLineColor;
  uniform vec3 uBaseColor;

  void main() {
    // Grid coordinates in world space
    vec2 gridCoord = vWorldPos / uSpacing;
    vec2 gridFract = abs(fract(gridCoord - 0.5) - 0.5);
    vec2 gridDeriv = fwidth(gridCoord);

    // Anti-aliased line: intensity based on distance to nearest grid line
    vec2 lineIntensity = smoothstep(vec2(0.0), gridDeriv * 1.5, gridFract);
    float lineMin = 1.0 - min(lineIntensity.x, lineIntensity.y);

    // Major grid every 1m (every 4 cells at 0.25m spacing)
    vec2 majorCoord = vWorldPos / (uSpacing * 4.0);
    vec2 majorFract = abs(fract(majorCoord - 0.5) - 0.5);
    vec2 majorDeriv = fwidth(majorCoord);
    vec2 majorIntensity = smoothstep(vec2(0.0), majorDeriv * 1.5, majorFract);
    float majorLine = 1.0 - min(majorIntensity.x, majorIntensity.y);

    // Combine: minor lines dim, major lines brighter
    float gridAlpha = lineMin * 0.04 + majorLine * 0.10;

    // Distance fade — grid fades into void at edges
    float dist = length(vWorldPos);
    float fade = 1.0 - smoothstep(12.0, 18.0, dist);

    vec3 color = mix(uBaseColor, uLineColor, gridAlpha * fade);
    gl_FragColor = vec4(color, 1.0);
  }
`

export const StudioFloor: React.FC<StudioFloorProps> = ({ quality = 'HQ' }) => {
  const isHQ = quality === 'HQ'
  const gridMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const gridUniforms = useMemo(
    () => ({
      uSpacing: { value: GRID_SPACING },
      uLineColor: { value: new THREE.Color(GRID_COLOR) },
      uBaseColor: { value: new THREE.Color(FLOOR_COLOR) },
    }),
    [],
  )

  // Subtle camera-facing fade for the grid (optional refinement)
  useFrame(() => {
    // Grid is static — no per-frame updates needed unless we add hover effects
  })

  return (
    <group>
      {/* Reflective floor plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <MeshReflectorMaterial
          mirror={0.07}
          blur={[400, 100]}
          resolution={512}
          mixBlur={1}
          mixStrength={0.5}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color={FLOOR_COLOR}
          metalness={0.2}
          roughness={0.85}
        />
      </mesh>

      {/* Custom grid overlay — micro-surco shader */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]} // Slightly above floor to prevent z-fighting
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <shaderMaterial
          ref={gridMaterialRef}
          vertexShader={gridVertexShader}
          fragmentShader={gridFragmentShader}
          uniforms={gridUniforms}
          transparent={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default StudioFloor
