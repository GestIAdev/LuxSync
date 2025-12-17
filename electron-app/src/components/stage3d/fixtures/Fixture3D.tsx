/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💡 FIXTURE 3D - WAVE 30.1: Stage Command & Dashboard
 * Componente genérico de fixture 3D con efectos de luz e interactividad
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este componente renderiza cualquier tipo de fixture:
 * - Modelo 3D básico del cuerpo
 * - PointLight para iluminación de escena
 * - Sprite con glow para efecto visual
 * - Cono de luz volumétrico (para moving heads)
 * - Selection Ring (cuando está seleccionado)
 * - Hover Ring (feedback visual de cursor)
 * 
 * WAVE 30.1: Integración con selectionStore
 * 
 * @module components/stage3d/fixtures/Fixture3D
 * @version 30.1.0
 */

import React, { useRef, useMemo, useState, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useSelectionStore } from '../../../stores/selectionStore'

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
// GLOW SPRITE MATERIAL
// ═══════════════════════════════════════════════════════════════════════════

const createGlowMaterial = (color: THREE.Color, opacity: number) => {
  return new THREE.SpriteMaterial({
    map: null, // Usaremos color sólido con blending
    color: color,
    transparent: true,
    opacity: opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
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
  const groupRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const coneRef = useRef<THREE.Mesh>(null)
  const selectionRingRef = useRef<THREE.Mesh>(null)
  
  // Local hover state para animación
  const [localHover, setLocalHover] = useState(false)
  
  // Selection store actions
  const { select, toggleSelection, selectRange, lastSelectedId, setHovered } = useSelectionStore()
  
  // Calcular color Three.js
  const threeColor = useMemo(() => {
    return new THREE.Color(color.r / 255, color.g / 255, color.b / 255)
  }, [color.r, color.g, color.b])
  
  // Calcular rotación del beam para moving heads
  const beamRotation = useMemo(() => {
    if (type !== 'moving') return rotation
    
    // Convertir pan/tilt (0-1) a ángulos de rotación
    const panAngle = (pan - 0.5) * Math.PI * 0.8  // ±72°
    const tiltAngle = rotation[0] + (tilt - 0.5) * Math.PI * 0.5  // ±45° adicional
    
    return [tiltAngle, panAngle, 0] as [number, number, number]
  }, [type, pan, tilt, rotation])
  
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
  // ANIMATIONS
  // ═════════════════════════════════════════════════════════════════════════
  
  // Animación para efectos
  useFrame((state) => {
    if (type === 'strobe' && intensity > 0.8) {
      // Parpadeo de strobe
      const flash = Math.sin(state.clock.elapsedTime * 30) > 0
      if (lightRef.current) {
        lightRef.current.intensity = flash ? intensity * 5 : 0
      }
    }
    
    // Animación del selection ring (pulso)
    if (selectionRingRef.current && selected) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 4) * 0.2
      selectionRingRef.current.scale.setScalar(pulse)
    }
  })
  
  // Skip render si intensidad es 0 (optimización)
  const isActive = intensity > 0.01 || color.r + color.g + color.b > 5
  
  // Determinar estado visual
  const showHover = localHover || hovered
  
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* CUERPO DEL FIXTURE */}
      <mesh castShadow>
        {type === 'moving' ? (
          <capsuleGeometry args={[scale * 0.5, scale, 8, 16]} />
        ) : type === 'strobe' ? (
          <boxGeometry args={[scale * 2, scale * 0.5, scale]} />
        ) : (
          <cylinderGeometry args={[scale * 0.3, scale * 0.5, scale, 16]} />
        )}
        <meshStandardMaterial
          color={selected ? '#ffffff' : '#2d2d44'}
          metalness={0.7}
          roughness={0.3}
          emissive={threeColor}
          emissiveIntensity={isActive ? 0.1 : 0}
        />
      </mesh>
      
      {/* LENTE / APERTURA */}
      <mesh
        position={[0, -scale * 0.4, 0]}
        rotation={beamRotation}
      >
        <circleGeometry args={[scale * 0.35, 16]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={intensity}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* POINT LIGHT - Iluminación de escena */}
      {isActive && (
        <pointLight
          ref={lightRef}
          position={[0, -scale * 0.5, 0]}
          color={threeColor}
          intensity={intensity * 2}
          distance={type === 'moving' ? 15 : 10}
          decay={2}
          castShadow={type === 'moving'}
        />
      )}
      
      {/* GLOW SPRITE */}
      {isActive && (
        <sprite
          position={[0, -scale * 0.3, 0]}
          scale={[intensity * 2 + 0.5, intensity * 2 + 0.5, 1]}
        >
          <spriteMaterial
            color={threeColor}
            transparent
            opacity={intensity * 0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
      
      {/* CONO DE LUZ VOLUMÉTRICO (solo moving heads activos) */}
      {type === 'moving' && isActive && intensity > 0.1 && (
        <mesh
          ref={coneRef}
          position={[0, -scale * 0.5, 0]}
          rotation={beamRotation}
        >
          <coneGeometry args={[2 + intensity, 8, 16, 1, true]} />
          <meshBasicMaterial
            color={threeColor}
            transparent
            opacity={intensity * 0.15}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      
      {/* SELECTION RING - Anillo cyan animado */}
      {selected && (
        <mesh 
          ref={selectionRingRef}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, 0.1, 0]}
        >
          <ringGeometry args={[scale * 0.8, scale * 1.0, 32]} />
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[scale * 0.7, scale * 0.85, 32]} />
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
