/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💡 FIXTURE 3D - WAVE 436: 3D FIXTURE RENDERING
 * Generic 3D fixture component with realistic light effects
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Historical Features (WAVE 33.1):
 * ✅ Circular Glow Sprites with radial alphaMap (fixed square halos)
 * ✅ Moving Head = Base + Yoke (PAN) + Head (TILT)
 * ✅ Light beam originates from Head center
 * ✅ SpotLight with correct shadows
 * 
 * Module path: @/components/simulator/views/stage3d/fixtures/Fixture3D
 * 
 * Features:
 * - Realistic moving head 3D model
 * - Soft glow with radial gradient
 * - Volumetric cone from Head
 * - Interactive Selection/Hover Rings
 * 
 * @module components/stage3d/fixtures/Fixture3D
 * @version 33.1.0
 */

import React, { useRef, useMemo, useState, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { getTransientFixture } from '../../../../../stores/transientStore'
import { useFixtureRender } from '../../../../../hooks/useFixtureRender'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureColor {
  r: number
  g: number
  b: number
  hex?: string
}

export interface Fixture3DProps {
  id: string
  position: [number, number, number]
  rotation?: [number, number, number]
  type: 'par' | 'moving' | 'strobe' | 'laser'
  color: FixtureColor
  intensity: number
  pan?: number      // 0-1
  tilt?: number     // 0-1
  selected?: boolean
  hovered?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: () => void
  onPointerOut?: () => void
  /** Lista de todos los IDs de fixtures (para Shift+Click range) */
  allFixtureIds?: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const FIXTURE_SCALE: Record<string, number> = {
  par: 0.4,
  moving: 0.5,
  strobe: 0.3,
  laser: 0.35,
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOW TEXTURE GENERATOR - Radial gradient for soft circular halos
// ═══════════════════════════════════════════════════════════════════════════

const GLOW_TEXTURE_SIZE = 128

/** Cache de textura para no recrearla cada render */
let cachedGlowTexture: THREE.Texture | null = null

/**
 * Crea una textura circular con degradado radial suave
 * para eliminar los "square halos" y lograr luces difusas realistas
 */
const createRadialGlowTexture = (): THREE.Texture => {
  if (cachedGlowTexture) return cachedGlowTexture
  
  const canvas = document.createElement('canvas')
  canvas.width = GLOW_TEXTURE_SIZE
  canvas.height = GLOW_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!
  
  const centerX = GLOW_TEXTURE_SIZE / 2
  const centerY = GLOW_TEXTURE_SIZE / 2
  const radius = GLOW_TEXTURE_SIZE / 2
  
  // Crear degradado radial: blanco centro → transparente borde
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,           // Centro
    centerX, centerY, radius       // Borde
  )
  
  // Curva suave de falloff
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.9)')
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)')
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)')
  gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.05)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  cachedGlowTexture = texture
  
  return texture
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const Fixture3D: React.FC<Fixture3DProps> = ({
  id,
  position,
  rotation = [0, 0, 0],
  type,
  color,
  intensity,
  pan = 0.5,
  tilt = 0.5,
  selected = false,
  hovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
  allFixtureIds = [],
}) => {
  // ═════════════════════════════════════════════════════════════════════════
  // REFS - Moving Head Hierarchy: Base → Yoke (PAN) → Head (TILT)
  // ═════════════════════════════════════════════════════════════════════════
  const groupRef = useRef<THREE.Group>(null)
  const yokeRef = useRef<THREE.Group>(null)      // Rota en Y (PAN)
  const headRef = useRef<THREE.Group>(null)      // Rota en X (TILT)
  const lightRef = useRef<THREE.PointLight>(null)
  const spotLightRef = useRef<THREE.SpotLight>(null)
  const coneRef = useRef<THREE.Mesh>(null)
  const selectionRingRef = useRef<THREE.Mesh>(null)
  // 🔧 WAVE 350.8: Target dummy para spotlight (hereda rotación del head)
  const spotLightTargetRef = useRef<THREE.Object3D>(null)
  
  // Local hover state para animación
  const [localHover, setLocalHover] = useState(false)
  
  // Selection store actions
  const { select, toggleSelection, selectRange, lastSelectedId, setHovered } = useSelectionStore()
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 Computed Values
  // ─────────────────────────────────────────────────────────────────────────
  
  // Calcular color Three.js
  const threeColor = useMemo(() => {
    return new THREE.Color(color.r / 255, color.g / 255, color.b / 255)
  }, [color.r, color.g, color.b])
  
  // Glow texture radial (circular, soft falloff)
  const glowTexture = useMemo(() => createRadialGlowTexture(), [])
  
  // PAN angle (Yoke rotation around Y axis) - ±72°
  const panAngle = useMemo(() => (pan - 0.5) * Math.PI * 0.8, [pan])
  
  // TILT angle (Head rotation around X axis) - ±45°
  const tiltAngle = useMemo(() => (tilt - 0.5) * Math.PI * 0.5, [tilt])
  
  // Calcular rotación del beam para fixtures simples (no moving heads)
  const beamRotation = useMemo(() => {
    if (type !== 'moving') return rotation
    return rotation // Moving heads usan la jerarquía Base/Yoke/Head
  }, [type, rotation])
  
  // Scale del fixture según tipo
  const scale = FIXTURE_SCALE[type] || 0.4
  
  // ═════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═════════════════════════════════════════════════════════════════════════
  
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    
    // Primero ejecutar onClick prop si existe
    onClick?.(event)
    
    // Manejar selección con modificadores
    const nativeEvent = event.nativeEvent
    
    if (nativeEvent.shiftKey && lastSelectedId) {
      // Shift+Click: Selección de rango
      selectRange(lastSelectedId, id, allFixtureIds)
    } else if (nativeEvent.ctrlKey || nativeEvent.metaKey) {
      // Ctrl+Click: Toggle individual
      toggleSelection(id)
    } else {
      // Click normal: Reemplazar selección
      select(id, 'replace')
    }
  }, [onClick, id, select, toggleSelection, selectRange, lastSelectedId, allFixtureIds])
  
  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setLocalHover(true)
    setHovered(id)
    onPointerOver?.()
    // Cambiar cursor
    document.body.style.cursor = 'pointer'
  }, [id, setHovered, onPointerOver])
  
  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setLocalHover(false)
    setHovered(null)
    onPointerOut?.()
    // Restaurar cursor
    document.body.style.cursor = 'auto'
  }, [setHovered, onPointerOut])
  
  // ═════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 348: TRANSIENT UPDATES - Direct Physics Injection
  // ═════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 378: TRANSIENT UPDATES - Direct Physics Injection (NO LOGS)
  // ═════════════════════════════════════════════════════════════════════════
  // Bypass React/Zustand: Lee directamente del transient store @ 60fps
  // useFrame ejecuta cada frame ANTES del render de Three.js
  // ═════════════════════════════════════════════════════════════════════════
  
  // Refs para almacenar targets actualizados por transient
  const transientPanRef = useRef(pan)
  const transientTiltRef = useRef(tilt)
  
  // 🚂 WAVE 1150/1151: Visual Inertia Refs - Posición VISUAL actual (renderizada)
  // Diferente de transientPanRef/Tilt que son los TARGETS (donde queremos ir)
  const visualPanAngle = useRef((pan - 0.5) * Math.PI * 2.0)
  const visualTiltAngle = useRef(-(tilt - 0.5) * Math.PI * 1.0)
  
  // ═════════════════════════════════════════════════════════════════════════
  // ANIMATIONS & PAN/TILT UPDATES
  // � WAVE 1150: THE INERTIA DAMPENER - Physics-based damping
  // 🛑 WAVE 1151: THE SPEED LIMITER - Motor physics simulation
  // Unified loop: transient read + speed limiter + soft landing + animations
  // ═════════════════════════════════════════════════════════════════════════
  
  useFrame((state, delta) => {
    // ───────────────────────────────────────────────────────────────────────
    // PHASE 1: Read transient targets (bypass React)
    // ───────────────────────────────────────────────────────────────────────
    const transientFixture = getTransientFixture(id)
    
    if (transientFixture) {
      transientPanRef.current = transientFixture.pan ?? 0.5
      transientTiltRef.current = transientFixture.tilt ?? 0.5
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // PHASE 2: Calculate target angles
    // ───────────────────────────────────────────────────────────────────────
    const livePan = transientPanRef.current
    const liveTilt = transientTiltRef.current
    
    const targetPanAngle = (livePan - 0.5) * Math.PI * 2.0   // ±180°
    const targetTiltAngle = -(liveTilt - 0.5) * Math.PI * 1.0  // ±90° INVERTED
    
    // ───────────────────────────────────────────────────────────────────────
    // PHASE 3: � WAVE 1151: THE SPEED LIMITER - Motor Physics
    // ───────────────────────────────────────────────────────────────────────
    // MAX_SPEED = 300°/s → ~1.8s para giro completo de Pan (540°)
    // Simula limitaciones físicas de motores stepper (15kg de hardware)
    // ───────────────────────────────────────────────────────────────────────
    const MAX_ANGULAR_SPEED_DEG = 300 // Grados por segundo (ajustable)
    const maxStepRadians = THREE.MathUtils.degToRad(MAX_ANGULAR_SPEED_DEG * delta)
    
    // ───────────────────────────────────────────────────────────────────────
    // PHASE 4: 🛡️ TELEPORT DETECTION + SPEED CLAMPING
    // ───────────────────────────────────────────────────────────────────────
    const TELEPORT_THRESHOLD = Math.PI // 180° threshold
    
    // ─────────────────────────────────────────────────────────────────────
    // PAN: Calcular diferencia al objetivo
    // ─────────────────────────────────────────────────────────────────────
    const panDiff = targetPanAngle - visualPanAngle.current
    const absPanDiff = Math.abs(panDiff)
    
    if (absPanDiff > TELEPORT_THRESHOLD) {
      // TELEPORT: Cambio de escena → SNAP instantáneo
      visualPanAngle.current = targetPanAngle
    } else {
      // MOVIMIENTO FÍSICO: Limitar por velocidad máxima del motor
      const panStep = THREE.MathUtils.clamp(panDiff, -maxStepRadians, maxStepRadians)
      visualPanAngle.current += panStep
      
      // 🔧 WAVE 1151: SOFT LANDING - Si estamos MUY cerca, frenar suavemente
      // Esto previene "jitter" cuando el motor llega al target
      const SOFT_LANDING_ZONE = THREE.MathUtils.degToRad(5) // 5° de zona de frenado
      if (absPanDiff < SOFT_LANDING_ZONE) {
        const softFactor = absPanDiff / SOFT_LANDING_ZONE // 0 a 1
        const remainingDiff = targetPanAngle - visualPanAngle.current
        visualPanAngle.current += remainingDiff * (1 - softFactor) * 0.3 // LERP suave
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // TILT: Mismo algoritmo pero con rango más pequeño (±90°)
    // ─────────────────────────────────────────────────────────────────────
    const tiltDiff = targetTiltAngle - visualTiltAngle.current
    const absTiltDiff = Math.abs(tiltDiff)
    
    if (absTiltDiff > TELEPORT_THRESHOLD) {
      // TELEPORT: SNAP instantáneo
      visualTiltAngle.current = targetTiltAngle
    } else {
      // MOVIMIENTO FÍSICO: Speed limiter
      const tiltStep = THREE.MathUtils.clamp(tiltDiff, -maxStepRadians, maxStepRadians)
      visualTiltAngle.current += tiltStep
      
      // SOFT LANDING
      const SOFT_LANDING_ZONE = THREE.MathUtils.degToRad(5)
      if (absTiltDiff < SOFT_LANDING_ZONE) {
        const softFactor = absTiltDiff / SOFT_LANDING_ZONE
        const remainingDiff = targetTiltAngle - visualTiltAngle.current
        visualTiltAngle.current += remainingDiff * (1 - softFactor) * 0.3
      }
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // PHASE 5: Apply visual rotation to Moving Head
    // ⚡ PERFORMANCE: Imperativo, 0 re-renders
    // ───────────────────────────────────────────────────────────────────────
    if (type === 'moving') {
      if (yokeRef.current) {
        yokeRef.current.rotation.y = visualPanAngle.current
      }
      
      if (headRef.current) {
        headRef.current.rotation.x = visualTiltAngle.current
      }
      
      // 🔧 WAVE 350.8: Conectar spotlight al target dummy
      if (spotLightRef.current && spotLightTargetRef.current) {
        spotLightRef.current.target = spotLightTargetRef.current
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Strobe Flash Effect
    // ─────────────────────────────────────────────────────────────────────
    if (type === 'strobe' && intensity > 0.8) {
      const flash = Math.sin(state.clock.elapsedTime * 30) > 0
      if (lightRef.current) {
        lightRef.current.intensity = flash ? intensity * 5 : 0
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Selection Ring Pulse Animation
    // ─────────────────────────────────────────────────────────────────────
    if (selectionRingRef.current && selected) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 4) * 0.2
      selectionRingRef.current.scale.setScalar(pulse)
    }
  })
  
  // Skip render si intensidad es 0 (optimización)
  const isActive = intensity > 0.01 || color.r + color.g + color.b > 5
  
  // Determinar estado visual
  const showHover = localHover || hovered
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER HELPER: Moving Head (Base + Yoke + Head)
  // ═════════════════════════════════════════════════════════════════════════
  const renderMovingHead = () => (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          BASE - Estática, anclada al truss/suelo
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh castShadow position={[0, scale * 0.3, 0]}>
        <cylinderGeometry args={[scale * 0.4, scale * 0.5, scale * 0.4, 16]} />
        <meshStandardMaterial
          color={selected ? '#444466' : '#1a1a2e'}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* ═══════════════════════════════════════════════════════════════════
          YOKE - Rota en PAN (eje Y)
          ═══════════════════════════════════════════════════════════════════ */}
      <group ref={yokeRef}>
        {/* Brazos laterales del yoke */}
        <mesh position={[-scale * 0.35, 0, 0]} castShadow>
          <boxGeometry args={[scale * 0.08, scale * 0.6, scale * 0.08]} />
          <meshStandardMaterial
            color={selected ? '#555577' : '#252538'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[scale * 0.35, 0, 0]} castShadow>
          <boxGeometry args={[scale * 0.08, scale * 0.6, scale * 0.08]} />
          <meshStandardMaterial
            color={selected ? '#555577' : '#252538'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        
        {/* ═════════════════════════════════════════════════════════════════
            HEAD - Rota en TILT (eje X), emite luz
            ═════════════════════════════════════════════════════════════════ */}
        <group ref={headRef} position={[0, -scale * 0.1, 0]}>
          {/* Cuerpo del Head (capsule) */}
          <mesh castShadow>
            <capsuleGeometry args={[scale * 0.25, scale * 0.35, 8, 16]} />
            <meshStandardMaterial
              color={selected ? '#ffffff' : '#2d2d44'}
              metalness={0.7}
              roughness={0.3}
              emissive={threeColor}
              emissiveIntensity={isActive ? 0.2 : 0}
            />
          </mesh>
          
          {/* Lente / Apertura del Head */}
          <mesh position={[0, -scale * 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[scale * 0.22, 24]} />
            <meshBasicMaterial
              color={threeColor}
              transparent
              opacity={intensity * 0.8 + 0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* ═══════════════════════════════════════════════════════════════
              LIGHT EFFECTS - Nacen del centro del Head
              ═══════════════════════════════════════════════════════════════ */}
          
          {/* 🔧 WAVE 350.8: Target dummy - hereda rotación del head */}
          <object3D ref={spotLightTargetRef} position={[0, -10, 0]} />
          
          {/* SpotLight - Luz dirigida real */}
          {isActive && (
            <spotLight
              ref={spotLightRef}
              position={[0, -scale * 0.4, 0]}
              color={threeColor}
              intensity={intensity * 8}
              distance={20}
              angle={0.5 + intensity * 0.3}
              penumbra={0.5}
              decay={1.5}
              castShadow
              shadow-mapSize-width={512}
              shadow-mapSize-height={512}
            />
          )}
          
          {/* GLOW SPRITE - Circular suave (NO cuadrado) */}
          {isActive && (
            <sprite
              position={[0, -scale * 0.45, 0]}
              scale={[intensity * 2.5 + 0.8, intensity * 2.5 + 0.8, 1]}
            >
              <spriteMaterial
                map={glowTexture}
                color={threeColor}
                transparent
                opacity={intensity * 0.7}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          )}
          
          {/* CONO DE LUZ VOLUMÉTRICO */}
          {/* 🔧 WAVE 350.8: El cono HEREDA la rotación del head (está dentro del group) */}
          {/* ConeGeometry: punta en Y+ local, base en Y- local */}
          {/* El cono apunta naturalmente hacia -Y (abajo), que es correcto cuando head.rotation.x=0 */}
          {/* Cuando el head rota en X, el cono lo sigue automáticamente */}
          {isActive && intensity > 0.1 && (() => {
            const coneHeight = 8 + intensity * 4
            const coneRadius = 2 + intensity * 1.5
            return (
              <mesh
                ref={coneRef}
                position={[0, -coneHeight / 2, 0]}
                // No rotation - hereda del parent (headRef group)
              >
                <coneGeometry args={[coneRadius, coneHeight, 24, 1, true]} />
                <meshBasicMaterial
                  color={threeColor}
                  transparent
                  opacity={intensity * 0.12}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )
          })()}
        </group>
      </group>
    </>
  )
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER HELPER: PAR Can (simple)
  // ═════════════════════════════════════════════════════════════════════════
  const renderParCan = () => (
    <>
      {/* Cuerpo del PAR */}
      <mesh castShadow>
        <cylinderGeometry args={[scale * 0.3, scale * 0.5, scale, 16]} />
        <meshStandardMaterial
          color={selected ? '#ffffff' : '#2d2d44'}
          metalness={0.7}
          roughness={0.3}
          emissive={threeColor}
          emissiveIntensity={isActive ? 0.1 : 0}
        />
      </mesh>
      
      {/* Lente */}
      <mesh position={[0, -scale * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[scale * 0.45, 24]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={intensity * 0.8 + 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* PointLight */}
      {isActive && (
        <pointLight
          ref={lightRef}
          position={[0, -scale * 0.5, 0]}
          color={threeColor}
          intensity={intensity * 3}
          distance={10}
          decay={2}
        />
      )}
      
      {/* GLOW SPRITE - Circular */}
      {isActive && (
        <sprite
          position={[0, -scale * 0.4, 0]}
          scale={[intensity * 2 + 0.6, intensity * 2 + 0.6, 1]}
        >
          <spriteMaterial
            map={glowTexture}
            color={threeColor}
            transparent
            opacity={intensity * 0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
    </>
  )
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER HELPER: Strobe
  // ═════════════════════════════════════════════════════════════════════════
  const renderStrobe = () => (
    <>
      <mesh castShadow>
        <boxGeometry args={[scale * 2, scale * 0.5, scale]} />
        <meshStandardMaterial
          color={selected ? '#ffffff' : '#2d2d44'}
          metalness={0.7}
          roughness={0.3}
          emissive={threeColor}
          emissiveIntensity={isActive ? 0.3 : 0}
        />
      </mesh>
      
      {isActive && (
        <pointLight
          ref={lightRef}
          position={[0, -scale * 0.3, 0]}
          color={threeColor}
          intensity={intensity * 5}
          distance={12}
          decay={2}
        />
      )}
      
      {isActive && (
        <sprite
          position={[0, -scale * 0.25, 0]}
          scale={[intensity * 3 + 1, intensity * 1.5 + 0.5, 1]}
        >
          <spriteMaterial
            map={glowTexture}
            color={threeColor}
            transparent
            opacity={intensity * 0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
    </>
  )
  
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* FIXTURE GEOMETRY - Según tipo */}
      {type === 'moving' && renderMovingHead()}
      {type === 'par' && renderParCan()}
      {type === 'strobe' && renderStrobe()}
      {type === 'laser' && renderParCan()} {/* Laser usa mismo render que PAR por ahora */}
      
      {/* SELECTION RING - Anillo cyan animado */}
      {selected && (
        <mesh 
          ref={selectionRingRef}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, 0.15, 0]}
        >
          <ringGeometry args={[scale * 0.9, scale * 1.1, 32]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* HOVER RING - Anillo magenta para feedback */}
      {showHover && !selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[scale * 0.8, scale * 0.95, 32]} />
          <meshBasicMaterial
            color="#ff00ff"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export default Fixture3D
