import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useStageStore } from '../../../../../stores/stageStore'
import type { ToolMode } from '../../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// MeasureLayer3D — Cotas entre fixtures (Measure Tool, 3D)
// PROYECTO EREBUS — Measure Tool
//
// En toolMode='measure':
//   - Click fixture A → marca primer punto (esfera ámbar)
//   - Hover → línea fantasma hacia cursor
//   - Click fixture B → línea de cota con distancia 3D
//   - Esc o click vacío → reset
//
// Muestra distancia 3D euclidiana + desglose DX/DY/DZ.
// ═══════════════════════════════════════════════════════════════════════════

interface MeasureLayer3DProps {
  toolMode: ToolMode
}

interface MeasurePoint3D {
  id: string
  position: THREE.Vector3
}

const ACCENT = '#5EEAD4'
const AMBER = '#F5B04D'
const INK = '#8B94A8'

export const MeasureLayer3D: React.FC<MeasureLayer3DProps> = ({ toolMode }) => {
  const fixtures = useStageStore(s => s.fixtures)
  const { gl, camera, raycaster } = useThree()
  const [pointA, setPointA] = useState<MeasurePoint3D | null>(null)
  const [pointB, setPointB] = useState<MeasurePoint3D | null>(null)
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const intersectionRef = useRef(new THREE.Vector3())

  // Reset when leaving measure mode
  useEffect(() => {
    if (toolMode !== 'measure') {
      setPointA(null)
      setPointB(null)
      setHoverPos(null)
    }
  }, [toolMode])

  // Esc to reset
  useEffect(() => {
    if (toolMode !== 'measure') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPointA(null)
        setPointB(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toolMode])

  // Track hover position on ground plane
  useEffect(() => {
    if (toolMode !== 'measure' || !pointA || pointB) return

    const handleMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera)
      const hit = raycaster.ray.intersectPlane(groundPlane, intersectionRef.current)
      if (hit) setHoverPos(hit.clone())
    }

    window.addEventListener('pointermove', handleMove)
    return () => window.removeEventListener('pointermove', handleMove)
  }, [toolMode, pointA, pointB, gl, camera, raycaster, groundPlane])

  const handleFixtureClick = useCallback(
    (e: any) => {
      if (toolMode !== 'measure') return
      e.stopPropagation()

      let obj = e.object
      let fixtureId: string | undefined
      while (obj) {
        if (obj.userData?.fixtureId) {
          fixtureId = obj.userData.fixtureId
          break
        }
        obj = obj.parent
      }
      if (!fixtureId) return

      const f = fixtures.find(fx => fx.id === fixtureId)
      if (!f) return

      const pos = new THREE.Vector3(f.position.x, f.position.y, f.position.z)

      if (!pointA) {
        setPointA({ id: fixtureId, position: pos })
      } else if (pointA.id === fixtureId) {
        setPointA(null)
      } else {
        setPointB({ id: fixtureId, position: pos })
      }
    },
    [toolMode, fixtures, pointA],
  )

  const measure = useMemo(() => {
    const a = pointA
    const b = pointB ?? (hoverPos ? { id: '__hover__', position: hoverPos } : null)
    if (!a || !b) return null
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const dz = b.position.z - a.position.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    return { a: a.position, b: b.position, dx, dy, dz, dist, isFinal: !!pointB }
  }, [pointA, pointB, hoverPos])

  if (toolMode !== 'measure') return null

  return (
    <group>
      {/* Click targets on fixtures */}
      {fixtures.map(f => (
        <mesh
          key={f.id}
          position={[f.position.x, f.position.y, f.position.z]}
          onPointerDown={handleFixtureClick}
        >
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial
            transparent
            opacity={pointA?.id === f.id ? 0.4 : 0.01}
            color={pointA?.id === f.id ? ACCENT : 0xffffff}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Measure line */}
      {measure && (
        <group>
          {/* Main line */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    measure.a.x, measure.a.y, measure.a.z,
                    measure.b.x, measure.b.y, measure.b.z,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={measure.isFinal ? ACCENT : AMBER} linewidth={2} />
          </line>

          {/* Endpoint A */}
          <mesh position={[measure.a.x, measure.a.y, measure.a.z]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={ACCENT} />
          </mesh>

          {/* Endpoint B */}
          <mesh position={[measure.b.x, measure.b.y, measure.b.z]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={measure.isFinal ? ACCENT : AMBER} transparent opacity={measure.isFinal ? 1 : 0.5} />
          </mesh>

          {/* Distance label */}
          <Html
            position={[
              (measure.a.x + measure.b.x) / 2,
              (measure.a.y + measure.b.y) / 2 + 0.15,
              (measure.a.z + measure.b.z) / 2,
            ]}
            center
            style={{
              pointerEvents: 'none',
              background: 'rgba(20, 23, 31, 0.9)',
              border: `1px solid ${measure.isFinal ? ACCENT : AMBER}`,
              borderRadius: '4px',
              padding: '4px 8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: measure.isFinal ? ACCENT : AMBER,
              whiteSpace: 'nowrap',
            }}
          >
            <div>{measure.dist.toFixed(2)}m</div>
            {measure.isFinal && (
              <div style={{ fontSize: '9px', color: INK, marginTop: '2px' }}>
                ΔX:{measure.dx.toFixed(2)} ΔY:{measure.dy.toFixed(2)} ΔZ:{measure.dz.toFixed(2)}
              </div>
            )}
          </Html>
        </group>
      )}
    </group>
  )
}

export default MeasureLayer3D
