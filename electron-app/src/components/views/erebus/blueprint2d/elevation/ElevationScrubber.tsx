import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { snapToVoxel, VOXEL_SIZE } from '../../../../../core/stage/ShowFileV2'
import type { FixtureV2 } from '../../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// ElevationScrubber — Scroll a Elevación (Nivel 3)
// PROYECTO EREBUS FASE 7
//
// Captura onWheel (scroll) o arrastre vertical con Alt mientras se hace
// hover sobre un símbolo 2D. Cada muesca del scroll ajusta position.y
// en saltos de 0.25m usando setFixtureElevation del store.
//
// Durante el ajuste:
//   - Fija un flag de cota temporal en --obs-amber (estado de edición)
//   - Notifica al componente padre para mostrar SectionProfileGhost + CoverageRing
//
// DEUDA TÉCNICA: usa estado local para hover/active en lugar de
// selectionStore. Migrar cuando se integre el store unificado.
// ═══════════════════════════════════════════════════════════════════════════

const SCRUB_STEP = VOXEL_SIZE // 0.25m per scroll notch
const FADE_OUT_MS = 400

export interface ElevationState {
  fixtureId: string
  y: number
  active: boolean
}

interface ElevationScrubberProps {
  /** Fixtures to monitor for hover */
  fixtures: FixtureV2[]
  /** Called when elevation is being scrubbed (for SectionProfileGhost + CoverageRing) */
  onElevationChange?: (state: ElevationState | null) => void
}

export const ElevationScrubber: React.FC<ElevationScrubberProps> = ({
  fixtures,
  onElevationChange,
}) => {
  const setFixtureElevation = useStageStore(s => s.setFixtureElevation)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [elevationState, setElevationState] = useState<ElevationState | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const altDragRef = useRef<{ startClientY: number; fixtureId: string; startElevation: number } | null>(null)

  // ── Handle wheel over a fixture ────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: WheelEvent, fixtureId: string) => {
      e.preventDefault()
      e.stopPropagation()

      const fixture = fixtures.find(f => f.id === fixtureId)
      if (!fixture) return

      // deltaY > 0 = scroll down = decrease elevation
      const direction = e.deltaY > 0 ? -1 : 1
      const newY = snapToVoxel(fixture.position.y + direction * SCRUB_STEP)

      setFixtureElevation(fixtureId, newY)

      const newState: ElevationState = {
        fixtureId,
        y: newY,
        active: true,
      }
      setElevationState(newState)
      onElevationChange?.(newState)

      // Reset fade timer
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current)
      }
      fadeTimerRef.current = window.setTimeout(() => {
        setElevationState(null)
        onElevationChange?.(null)
        fadeTimerRef.current = null
      }, FADE_OUT_MS)
    },
    [fixtures, setFixtureElevation, onElevationChange],
  )

  // ── Alt+drag vertical for elevation ────────────────────────────────────────
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!altDragRef.current) return
      if (!e.altKey) {
        altDragRef.current = null
        return
      }

      const drag = altDragRef.current
      const deltaY = e.clientY - drag.startClientY
      // 1 pixel = 0.05m, snapped to voxel
      const rawY = drag.startElevation + deltaY * 0.05
      const newY = snapToVoxel(rawY)

      setFixtureElevation(drag.fixtureId, newY)

      const newState: ElevationState = {
        fixtureId: drag.fixtureId,
        y: newY,
        active: true,
      }
      setElevationState(newState)
      onElevationChange?.(newState)
    }

    const handleUp = () => {
      if (altDragRef.current) {
        altDragRef.current = null
        // Start fade timer
        if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = window.setTimeout(() => {
          setElevationState(null)
          onElevationChange?.(null)
          fadeTimerRef.current = null
        }, FADE_OUT_MS)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [setFixtureElevation, onElevationChange])

  // ── Attach wheel listeners to fixture symbols ──────────────────────────────
  // We use a global wheel listener and check if we're hovering a fixture
  useEffect(() => {
    if (!hoveredId) return

    const handler = (e: WheelEvent) => handleWheel(e, hoveredId)
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [hoveredId, handleWheel])

  // ── Render: invisible hover circles + elevation chip ───────────────────────
  return (
    <g className="elevation-scrubber" pointerEvents="all">
      {/* Hover detection circles */}
      {fixtures.map(f => (
        <circle
          key={f.id}
          cx={f.position.x}
          cy={f.position.z}
          r={0.2}
          fill="transparent"
          style={{ cursor: 'ns-resize' }}
          onPointerEnter={() => setHoveredId(f.id)}
          onPointerLeave={() => setHoveredId(null)}
          onPointerDown={(e) => {
            if (e.altKey) {
              e.stopPropagation()
              altDragRef.current = {
                startClientY: e.clientY,
                fixtureId: f.id,
                startElevation: f.position.y,
              }
            }
          }}
        />
      ))}

      {/* Elevation chip during active scrubbing */}
      {elevationState && (() => {
        const fixture = fixtures.find(f => f.id === elevationState.fixtureId)
        if (!fixture) return null
        return (
          <g pointerEvents="none">
            {/* Guide line NE */}
            <line
              x1={fixture.position.x}
              y1={fixture.position.z}
              x2={fixture.position.x + 0.16}
              y2={fixture.position.z - 0.16}
              stroke="var(--obs-amber, #F5B04D)"
              strokeWidth={0.004}
            />
            {/* Chip background */}
            <rect
              x={fixture.position.x + 0.16}
              y={fixture.position.z - 0.26}
              width={0.28}
              height={0.12}
              fill="var(--obs-floor, #14171F)"
              stroke="var(--obs-amber, #F5B04D)"
              strokeWidth={0.003}
              rx={0.02}
            />
            {/* Chip text */}
            <text
              x={fixture.position.x + 0.3}
              y={fixture.position.z - 0.17}
              fill="var(--obs-amber, #F5B04D)"
              fontSize={0.07}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {`▲ ${elevationState.y.toFixed(2)}m`}
            </text>
          </g>
        )
      })()}
    </g>
  )
}

export default ElevationScrubber
