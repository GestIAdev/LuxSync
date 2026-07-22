import React, { useMemo } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// RigPlanLayer — Trusses en planta (2D)
// PROYECTO EREBUS — Rig System
//
// Renderiza rigs en el blueprint 2D:
//   - Truss: doble línea con marcas de sección cada 2m
//   - Totem: cuadrado con X interior
//   - Fixtures anclados se dibujan SOBRE la línea con tick de anclaje
//
// Trazo --obs-surface a 1px, relleno transparente.
// Seleccionado: borde --obs-accent.
// ═══════════════════════════════════════════════════════════════════════════

const TRUSS_LENGTH = 3
const TRUSS_HALF_WIDTH = 0.15 // 30cm section
const TOTEM_SIZE = 0.3
const STROKE = 'var(--obs-surface, #1B1F2A)'
const STROKE_WIDTH = 0.008
const SELECTED_STROKE = 'var(--obs-accent, #5EEAD4)'
const MARK_SPACING = 1.0 // section marks every 1m

interface RigPlanLayerProps {
  stageWidth?: number
  stageDepth?: number
  padding?: number
}

export const RigPlanLayer: React.FC<RigPlanLayerProps> = () => {
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const fixtures = useStageStore(s => s.fixtures)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const select = useSelectionStore(s => s.select)

  const anchoredByRig = useMemo(() => {
    const map: Record<string, typeof fixtures> = {}
    for (const f of fixtures) {
      if (f.rigId) {
        if (!map[f.rigId]) map[f.rigId] = []
        map[f.rigId].push(f)
      }
    }
    return map
  }, [fixtures])

  if (rigs.length === 0) return null

  return (
    <g className="rig-plan-layer">
      {rigs.map(rig => {
        const isSelected = selectedIds.has(rig.id)
        const isTotem = rig.orientation === 'totem'
        const stroke = isSelected ? SELECTED_STROKE : STROKE
        const anchored = anchoredByRig[rig.id] ?? []

        if (isTotem) {
          const s = TOTEM_SIZE
          return (
            <g
              key={rig.id}
              onPointerDown={(e) => {
                e.stopPropagation()
                if (e.ctrlKey || e.metaKey) select(rig.id, 'toggle')
                else if (e.shiftKey) select(rig.id, 'add')
                else select(rig.id, 'replace')
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Square base */}
              <rect
                x={rig.position.x - s / 2}
                y={rig.position.z - s / 2}
                width={s}
                height={s}
                fill="none"
                stroke={stroke}
                strokeWidth={STROKE_WIDTH}
              />
              {/* X interior */}
              <line
                x1={rig.position.x - s / 2}
                y1={rig.position.z - s / 2}
                x2={rig.position.x + s / 2}
                y2={rig.position.z + s / 2}
                stroke={stroke}
                strokeWidth={STROKE_WIDTH * 0.7}
                opacity={0.5}
              />
              <line
                x1={rig.position.x + s / 2}
                y1={rig.position.z - s / 2}
                x2={rig.position.x - s / 2}
                y2={rig.position.z + s / 2}
                stroke={stroke}
                strokeWidth={STROKE_WIDTH * 0.7}
                opacity={0.5}
              />
              {/* Height label */}
              <text
                x={rig.position.x}
                y={rig.position.z + s / 2 + 0.12}
                fill="var(--obs-ink, #8B94A8)"
                fontSize={0.07}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {rig.height.toFixed(1)}m
              </text>
              {/* Anchored fixture ticks */}
              {anchored.map(f => (
                <circle
                  key={f.id}
                  cx={f.position.x}
                  cy={f.position.z}
                  r={0.04}
                  fill={SELECTED_STROKE}
                  opacity={0.6}
                />
              ))}
            </g>
          )
        }

        // Truss: double line along X axis
        const halfLen = TRUSS_LENGTH / 2
        const x1 = rig.position.x - halfLen
        const x2 = rig.position.x + halfLen
        const z = rig.position.z

        // Section marks
        const marks: React.ReactNode[] = []
        for (let dx = -halfLen; dx <= halfLen + 0.01; dx += MARK_SPACING) {
          const mx = rig.position.x + dx
          marks.push(
            <line
              key={`mark-${dx}`}
              x1={mx}
              y1={z - TRUSS_HALF_WIDTH}
              x2={mx}
              y2={z + TRUSS_HALF_WIDTH}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH * 0.5}
              opacity={0.4}
            />
          )
        }

        return (
          <g
            key={rig.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) select(rig.id, 'toggle')
              else if (e.shiftKey) select(rig.id, 'add')
              else select(rig.id, 'replace')
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Double line (top + bottom cord) */}
            <line
              x1={x1} y1={z - TRUSS_HALF_WIDTH}
              x2={x2} y2={z - TRUSS_HALF_WIDTH}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH}
            />
            <line
              x1={x1} y1={z + TRUSS_HALF_WIDTH}
              x2={x2} y2={z + TRUSS_HALF_WIDTH}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH}
            />
            {/* End caps */}
            <line x1={x1} y1={z - TRUSS_HALF_WIDTH} x2={x1} y2={z + TRUSS_HALF_WIDTH} stroke={stroke} strokeWidth={STROKE_WIDTH} />
            <line x1={x2} y1={z - TRUSS_HALF_WIDTH} x2={x2} y2={z + TRUSS_HALF_WIDTH} stroke={stroke} strokeWidth={STROKE_WIDTH} />
            {/* Section marks */}
            {marks}
            {/* Height label */}
            <text
              x={rig.position.x}
              y={z + TRUSS_HALF_WIDTH + 0.12}
              fill="var(--obs-ink, #8B94A8)"
              fontSize={0.07}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {rig.height.toFixed(1)}m
            </text>
            {/* Anchored fixture ticks (on the truss line) */}
            {anchored.map(f => (
              <g key={f.id}>
                <circle
                  cx={f.position.x}
                  cy={z}
                  r={0.04}
                  fill={SELECTED_STROKE}
                  opacity={0.6}
                />
                {/* Tick from truss to fixture */}
                <line
                  x1={f.position.x}
                  y1={z}
                  x2={f.position.x}
                  y2={f.position.z}
                  stroke={SELECTED_STROKE}
                  strokeWidth={0.004}
                  opacity={0.3}
                />
              </g>
            ))}
          </g>
        )
      })}
    </g>
  )
}

export default RigPlanLayer
