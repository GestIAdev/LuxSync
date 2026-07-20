import React, { useEffect, useRef, useState } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import type { ElevationState } from './ElevationScrubber'

// ═══════════════════════════════════════════════════════════════════════════
// SectionProfileGhost — Corte Lateral Efímero
// PROYECTO EREBUS FASE 7
//
// Renderiza una silueta de corte lateral en el margen derecho del
// BlueprintCanvas que aparece solo mientras el usuario altera la
// elevación con el scroll.
//
// Muestra:
//   - Suelo (Y=0) y techo (Y=stageHeight) del escenario
//   - Marcador indicando la posición en altura (Y) del foco actual
//   - Alturas de trusses cercanos como líneas de referencia
//
// Se desvanece (fade out) 400ms después de que termine el ajuste.
// ═══════════════════════════════════════════════════════════════════════════

interface SectionProfileGhostProps {
  /** Current elevation state from ElevationScrubber (null when inactive) */
  elevationState: ElevationState | null
  /** Stage dimensions */
  stageWidth?: number
  stageDepth?: number
  stageHeight?: number
  padding?: number
}

const FADE_DURATION_MS = 400
const PROFILE_WIDTH = 1.5 // meters of SVG width for the profile panel
const AMBER = 'var(--obs-amber, #F5B04D)'
const INK = 'var(--obs-ink, #8B94A8)'
const LINE = 'var(--obs-line, #2A3040)'
const BRIGHT = 'var(--obs-bright, #E4E9F2)'

export const SectionProfileGhost: React.FC<SectionProfileGhostProps> = ({
  elevationState,
  stageWidth = 12,
  stageDepth = 8,
  stageHeight = 6,
  padding = 2,
}) => {
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const fixtures = useStageStore(s => s.fixtures)

  const [opacity, setOpacity] = useState(0)
  const fadeTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  // ── Fade in/out animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (elevationState) {
      // Fade in immediately
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
      setOpacity(1)
    } else {
      // Fade out over 400ms
      const startTime = performance.now()
      const animate = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / FADE_DURATION_MS, 1)
        setOpacity(1 - t)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate)
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [elevationState])

  if (opacity <= 0.01) return null

  // ── Compute profile position (right margin of viewBox) ─────────────────────
  const profileX = stageWidth + padding - PROFILE_WIDTH
  const profileY = -padding
  const profileH = stageHeight + padding * 2
  const groundY = profileY + profileH - padding // Y=0 ground line
  const ceilingY = profileY + padding // Y=stageHeight ceiling line

  // Scale: 1 meter in Y = (profileH - 2*padding) / stageHeight pixels
  const yScale = (profileH - 2 * padding) / stageHeight

  // ── Current fixture marker ─────────────────────────────────────────────────
  const fixtureY = elevationState
    ? groundY - elevationState.y * yScale
    : 0

  // ── Rig reference lines ────────────────────────────────────────────────────
  const rigLines = rigs.filter(r => r.height > 0 && r.height <= stageHeight)

  // ── Other fixtures as dots ─────────────────────────────────────────────────
  const fixtureDots = fixtures
    .filter(f => f.id !== elevationState?.fixtureId)
    .map(f => ({
      id: f.id,
      y: groundY - f.position.y * yScale,
    }))

  return (
    <g
      className="section-profile-ghost"
      pointerEvents="none"
      opacity={opacity}
    >
      {/* Background panel */}
      <rect
        x={profileX}
        y={profileY}
        width={PROFILE_WIDTH}
        height={profileH}
        fill="var(--obs-floor, #14171F)"
        fillOpacity={0.85}
        stroke={LINE}
        strokeWidth={0.004}
        rx={0.05}
      />

      {/* Ground line (Y=0) */}
      <line
        x1={profileX + 0.1}
        y1={groundY}
        x2={profileX + PROFILE_WIDTH - 0.1}
        y2={groundY}
        stroke={BRIGHT}
        strokeWidth={0.005}
      />
      <text
        x={profileX + 0.12}
        y={groundY + 0.08}
        fill={INK}
        fontSize={0.06}
        fontFamily="monospace"
      >
        0m
      </text>

      {/* Ceiling line (Y=stageHeight) */}
      <line
        x1={profileX + 0.1}
        y1={ceilingY}
        x2={profileX + PROFILE_WIDTH - 0.1}
        y2={ceilingY}
        stroke={LINE}
        strokeWidth={0.003}
        strokeDasharray="0.05 0.03"
      />
      <text
        x={profileX + 0.12}
        y={ceilingY - 0.04}
        fill={INK}
        fontSize={0.06}
        fontFamily="monospace"
      >
        {stageHeight.toFixed(0)}m
      </text>

      {/* Rig reference lines */}
      {rigLines.map(rig => {
        const ry = groundY - rig.height * yScale
        return (
          <g key={rig.id}>
            <line
              x1={profileX + 0.15}
              y1={ry}
              x2={profileX + PROFILE_WIDTH - 0.15}
              y2={ry}
              stroke={INK}
              strokeWidth={0.002}
              strokeDasharray="0.03 0.02"
              opacity={0.5}
            />
            <text
              x={profileX + PROFILE_WIDTH - 0.12}
              y={ry - 0.03}
              fill={INK}
              fontSize={0.05}
              fontFamily="monospace"
              textAnchor="end"
            >
              {rig.height.toFixed(1)}
            </text>
          </g>
        )
      })}

      {/* Other fixtures as small dots */}
      {fixtureDots.map(d => (
        <circle
          key={d.id}
          cx={profileX + PROFILE_WIDTH / 2 - 0.15}
          cy={d.y}
          r={0.02}
          fill={INK}
          opacity={0.4}
        />
      ))}

      {/* Current fixture marker */}
      {elevationState && (
        <g>
          {/* Horizontal marker line */}
          <line
            x1={profileX + 0.1}
            y1={fixtureY}
            x2={profileX + PROFILE_WIDTH - 0.1}
            y2={fixtureY}
            stroke={AMBER}
            strokeWidth={0.005}
          />
          {/* Marker dot */}
          <circle
            cx={profileX + PROFILE_WIDTH / 2}
            cy={fixtureY}
            r={0.04}
            fill={AMBER}
          />
          {/* Elevation label */}
          <text
            x={profileX + PROFILE_WIDTH - 0.12}
            y={fixtureY - 0.04}
            fill={AMBER}
            fontSize={0.07}
            fontFamily="monospace"
            textAnchor="end"
            fontWeight="bold"
          >
            {elevationState.y.toFixed(2)}m
          </text>
        </g>
      )}

      {/* Title */}
      <text
        x={profileX + PROFILE_WIDTH / 2}
        y={profileY + 0.12}
        fill={INK}
        fontSize={0.06}
        fontFamily="monospace"
        textAnchor="middle"
      >
        SECTION
      </text>
    </g>
  )
}

export default SectionProfileGhost
