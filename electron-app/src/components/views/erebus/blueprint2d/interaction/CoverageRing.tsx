import React, { useMemo } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import type { ElevationState } from '../elevation/ElevationScrubber'

// ═══════════════════════════════════════════════════════════════════════════
// CoverageRing — Huella del Haz (Beam Footprint)
// PROYECTO EREBUS FASE 7
//
// Dibuja un círculo fino punteado proyectado en el suelo (Y=0).
// El radio se calcula trigonométricamente usando:
//   - La altura actual (position.y) del fixture
//   - El tiltRangeDeg del physics profile del fixture
//
// Fórmula: r = y * tan(tiltRange/2 en radianes)
//   - A mayor altura, mayor cobertura
//   - El anillo "respira" en tiempo real mientras se hace scroll
//
// Solo visible durante el scrubbing de elevación.
// ═══════════════════════════════════════════════════════════════════════════

interface CoverageRingProps {
  /** Current elevation state from ElevationScrubber (null when inactive) */
  elevationState: ElevationState | null
}

const ACCENT = 'var(--obs-accent, #5EEAD4)'
const AMBER = 'var(--obs-amber, #F5B04D)'
const DEFAULT_TILT_RANGE_DEG = 270 // fallback del backend

export const CoverageRing: React.FC<CoverageRingProps> = ({ elevationState }) => {
  const fixtures = useStageStore(s => s.fixtures)

  // ── Compute ring radius ────────────────────────────────────────────────────
  const ringData = useMemo(() => {
    if (!elevationState) return null

    const fixture = fixtures.find(f => f.id === elevationState.fixtureId)
    if (!fixture) return null

    const tiltRangeDeg = fixture.tiltRangeDeg ?? DEFAULT_TILT_RANGE_DEG
    const tiltRad = (tiltRangeDeg * Math.PI) / 180
    const halfTilt = tiltRad / 2

    // r = y * tan(halfTilt) — proyección del cono a Y=0
    const radius = Math.max(0.01, elevationState.y * Math.tan(halfTilt))

    return {
      cx: fixture.position.x,
      cy: fixture.position.z, // SVG Y = 3D Z
      radius,
      y: elevationState.y,
    }
  }, [elevationState, fixtures])

  if (!ringData) return null

  return (
    <g className="coverage-ring" pointerEvents="none">
      {/* Outer coverage circle (full tilt range) */}
      <circle
        cx={ringData.cx}
        cy={ringData.cy}
        r={ringData.radius}
        fill="none"
        stroke={AMBER}
        strokeWidth={0.004}
        strokeDasharray="0.08 0.04"
        opacity={0.6}
      />

      {/* Inner coverage circle (half tilt — typical working range) */}
      <circle
        cx={ringData.cx}
        cy={ringData.cy}
        r={ringData.radius * 0.5}
        fill="none"
        stroke={AMBER}
        strokeWidth={0.003}
        strokeDasharray="0.05 0.03"
        opacity={0.3}
      />

      {/* Center dot */}
      <circle
        cx={ringData.cx}
        cy={ringData.cy}
        r={0.02}
        fill={AMBER}
        opacity={0.5}
      />

      {/* Radius label */}
      <text
        x={ringData.cx + ringData.radius * 0.707}
        y={ringData.cy + ringData.radius * 0.707 + 0.06}
        fill={AMBER}
        fontSize={0.06}
        fontFamily="monospace"
        textAnchor="middle"
        opacity={0.7}
      >
        {`Ø ${(ringData.radius * 2).toFixed(2)}m`}
      </text>
    </g>
  )
}

export default CoverageRing
