import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'

// ═══════════════════════════════════════════════════════════════════════════
// FixtureBody3D — Foco en Reposo
// PROYECTO EREBUS FASE 3
//
// Cuerpo del fixture con materiales mate del estudio (cero glow genérico).
// Lente: único elemento con emisión tenue (2%) — "piloto de standby".
// Selección: shader fresnel para rim-light cian (--obs-accent) en la silueta.
//
// Geometría low-poly: cuerpo base + cabeza + lente.
// Sin lógica de interacción — pura representación visual pasiva.
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureBody3DProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  selected?: boolean
  /** Fixture type for geometry variation */
  fixtureType?: string
}

// ── Materials ──────────────────────────────────────────────────────────────

const BODY_COLOR = '#1E2024' // anthracite gray — metallic matte
const LENS_COLOR = '#2A3040' // --obs-line
const LENS_EMISSIVE = '#ffffff' // white emissive for standby pilot
const RIM_COLOR = '#5EEAD4' // --obs-accent

// ── Fresnel Selection Shader ───────────────────────────────────────────────

const fresnelVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`

const fresnelFragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uRimColor;
  uniform float uIntensity;
  void main() {
    float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    fresnel = pow(fresnel, 2.5);
    float alpha = fresnel * uIntensity;
    gl_FragColor = vec4(uRimColor, alpha);
  }
`

export const FixtureBody3D: React.FC<FixtureBody3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  selected = false,
  fixtureType = 'moving-head',
}) => {
  const rimMatRef = useRef<THREE.ShaderMaterial>(null)

  // Body material — matte studio finish
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(BODY_COLOR),
        metalness: 0.6,
        roughness: 0.4,
      }),
    [],
  )

  // Lens material — emissive standby pilot (2%)
  const lensMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(LENS_COLOR),
        emissive: new THREE.Color(LENS_EMISSIVE),
        emissiveIntensity: 0.05,
        metalness: 0.1,
        roughness: 0.3,
      }),
    [],
  )

  // Fresnel rim-light material for selection
  const rimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fresnelVertexShader,
        fragmentShader: fresnelFragmentShader,
        uniforms: {
          uRimColor: { value: new THREE.Color(RIM_COLOR) },
          uIntensity: { value: 0.0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  // Animate rim intensity on selection
  useFrame(({ clock }) => {
    if (!rimMatRef.current || !selected) return
    const t = clock.getElapsedTime()
    const pulse = 0.6 + Math.sin(t * 2) * 0.2
    rimMatRef.current.uniforms.uIntensity.value = pulse
  })

  // Update rim visibility
  React.useEffect(() => {
    if (rimMatRef.current) {
      rimMatRef.current.uniforms.uIntensity.value = selected ? 0.6 : 0.0
    }
  }, [selected])

  // ── Geometry: simplified moving-head shape ───────────────────────────────
  // Base cylinder (yoke mount) + head box + lens cylinder
  const isMovingHead = fixtureType === 'moving-head' || fixtureType === 'spot' || fixtureType === 'scanner'
  const isWash = fixtureType === 'par' || fixtureType === 'wash'

  return (
    <group position={position} rotation={rotation as any}>
      {/* Base / yoke */}
      <mesh material={bodyMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 12]} />
      </mesh>

      {/* Yoke arms */}
      <mesh material={bodyMaterial} position={[0.08, 0.1, 0]} castShadow>
        <boxGeometry args={[0.02, 0.2, 0.06]} />
      </mesh>
      <mesh material={bodyMaterial} position={[-0.08, 0.1, 0]} castShadow>
        <boxGeometry args={[0.02, 0.2, 0.06]} />
      </mesh>

      {/* Head */}
      <mesh
        material={bodyMaterial}
        position={[0, isMovingHead ? 0.2 : 0.15, 0]}
        castShadow
        receiveShadow
      >
        {isWash
          ? <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
          : <boxGeometry args={[0.14, 0.12, 0.14]} />}
        <Edges color="#00ffcc" opacity={0.25} transparent />
      </mesh>

      {/* Lens — the only emissive element (standby pilot) */}
      <mesh
        material={lensMaterial}
        position={[0, isMovingHead ? 0.2 : 0.15, isMovingHead ? 0.08 : 0.07]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {isWash
          ? <cylinderGeometry args={[0.09, 0.09, 0.01, 16]} />
          : <cylinderGeometry args={[0.05, 0.05, 0.01, 16]} />}
      </mesh>

      {/* Selection rim-light overlay (fresnel) */}
      {selected && (
        <mesh material={rimMaterial}>
          <icosahedronGeometry args={[0.22, 1]} />
        </mesh>
      )}
    </group>
  )
}

export default FixtureBody3D
