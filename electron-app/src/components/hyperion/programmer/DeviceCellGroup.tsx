/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 DEVICE CELL GROUP — WAVE 4725: CAMALEÓN UI LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wrapper de células de capacidad para UN device.
 * Recibe las `cells[]` del hook `useCapabilityCells` y las renderiza
 * como secciones colapsables (IntensitySection | ColorSection | BeamSection)
 * según la familia de cada célula.
 *
 * SISTEMA NEON:
 *   Cada device tiene un color neon basado en el `role` de su primera célula.
 *   Se inyecta como CSS custom property `--neon-base` en el wrapper,
 *   de modo que las secciones hijas la heredan sin prop drilling.
 *
 * DECISIONES DE ARQUITECTURA:
 * - DeviceCellGroup lee los valores actuales del store para cada CellKey
 *   y los traduce a los props legacy de cada Section (bridge de transición).
 * - La familia KINETIC no se renderiza aquí — es dominio exclusivo del
 *   KineticsCathedral.
 * - Cada sección recibe los callbacks de write que van a los setters cell-*.
 *
 * @module components/hyperion/programmer/DeviceCellGroup
 * @version WAVE 4725
 */

import React, { useState, useCallback } from 'react'
import type { CellDescriptor, ImpactCellPayload, ColorCellPayload, BeamCellPayload } from '../../../stores/programmer-types'
import { NodeFamily } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { IntensitySection } from '../controls/IntensitySection'
import { ColorSection } from '../controls/ColorSection'
import { BeamSection } from '../controls/BeamSection'
import './DeviceCellGroup.css'

// ─────────────────────────────────────────────────────────────────────────────
// ROLE NEON — Blueprint §4.2
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_NEON: Record<string, { hex: string; glow: string }> = {
  master:    { hex: '#ff3366', glow: 'rgba(255,51,102,0.35)' },
  primary:   { hex: '#ff3366', glow: 'rgba(255,51,102,0.35)' },
  wash:      { hex: '#36d1ff', glow: 'rgba(54,209,255,0.35)' },
  petal:     { hex: '#d946ef', glow: 'rgba(217,70,239,0.35)' },
  beam:      { hex: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  rotor:     { hex: '#22c55e', glow: 'rgba(34,197,94,0.35)' },
  ambient:   { hex: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' },
  percussion: { hex: '#22c55e', glow: 'rgba(34,197,94,0.35)' },
  decoration:{ hex: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  atmosphere:{ hex: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' },
  pixel:     { hex: '#36d1ff', glow: 'rgba(54,209,255,0.35)' },
  unknown:   { hex: '#94a3b8', glow: 'rgba(148,163,184,0.2)' },
}

function getNeon(role: string): { hex: string; glow: string } {
  return ROLE_NEON[role] ?? ROLE_NEON.unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceCellGroupProps {
  deviceId: string
  fixtureName: string
  fixtureType: string
  cells: CellDescriptor[]
  onSectionToggle: (sectionKey: string) => void
  onOverrideChange?: (hasOverride: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const DeviceCellGroup: React.FC<DeviceCellGroupProps> = ({
  deviceId,
  fixtureName,
  fixtureType,
  cells,
  onSectionToggle,
  onOverrideChange,
}) => {
  // Sección activa local (dentro del grupo)
  const [localSection, setLocalSection] = useState<string | null>(null)

  // Leer todos los cellOverrides del store (el componente re-renderiza solo cuando cambian)
  const cellOverrides = useProgrammerStore(s => s.cellOverrides)
  const setCellImpact = useProgrammerStore(s => s.setCellImpact)
  const setCellColor  = useProgrammerStore(s => s.setCellColor)
  const releaseCell   = useProgrammerStore(s => s.releaseCell)

  const toggleSection = useCallback((key: string) => {
    setLocalSection(prev => prev === key ? null : key)
    onSectionToggle(key)
  }, [onSectionToggle])

  if (cells.length === 0) return null

  // Determinar neon desde el rol de la primera célula principal
  const primaryCell = cells.find(c =>
    c.family === NodeFamily.IMPACT || c.family === NodeFamily.COLOR,
  ) ?? cells[0]
  const neon = getNeon(primaryCell.role)

  // CSS variables inyectadas en el wrapper
  const wrapperStyle: React.CSSProperties & { [key: `--${string}`]: string } = {
    '--neon-base': neon.hex,
    '--neon-glow': neon.glow,
  }

  return (
    <div
      className="device-cell-group"
      style={wrapperStyle}
      data-device-id={deviceId}
    >
      {/* DEVICE HEADER */}
      <div className="dcg-header">
        <span
          className="dcg-neon-dot"
          style={{ background: neon.hex, boxShadow: `0 0 6px ${neon.hex}` }}
        />
        <span className="dcg-name">{fixtureName}</span>
        <span className="dcg-type">{fixtureType}</span>
      </div>

      {/* CÉLULAS */}
      {cells.map(cell => {
        const sectionKey = `${deviceId}:${cell.family}`
        const isExpanded = localSection === sectionKey
        const ov = cellOverrides.get(cell.cellKey)

        switch (cell.family) {
          case NodeFamily.IMPACT: {
            const data = (ov?.payload.family === NodeFamily.IMPACT
              ? ov.payload.data
              : {}) as ImpactCellPayload

            const dimmer  = data.dimmer  !== undefined ? Math.round(data.dimmer  * 100) : null
            const strobe  = data.strobe  !== undefined ? Math.round(data.strobe  * 100) : null
            const limit   = data.limit   !== undefined ? Math.round(data.limit   * 100) : null
            const hasDimmer = data.dimmer !== undefined
            const hasStrobe = data.strobe !== undefined
            const hasLimit  = data.limit  !== undefined && data.limit < 1

            return (
              <IntensitySection
                key={cell.cellKey}
                value={dimmer}
                hasOverride={hasDimmer}
                strobeValue={strobe}
                hasStrobeOverride={hasStrobe}
                limitValue={limit ?? 100}
                hasLimitActive={hasLimit}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
                onChange={v => setCellImpact(cell.cellKey, 'dimmer', v)}
                onRelease={() => releaseCell(cell.cellKey)}
                onStrobeChange={v => setCellImpact(cell.cellKey, 'strobe', v)}
                onStrobeRelease={() => releaseCell(cell.cellKey)}
                onLimitChange={v => setCellImpact(cell.cellKey, 'limit', v)}
                onLimitRelease={() => releaseCell(cell.cellKey)}
              />
            )
          }

          case NodeFamily.COLOR: {
            const data = (ov?.payload.family === NodeFamily.COLOR
              ? ov.payload.data
              : {}) as ColorCellPayload

            const r = data.r !== undefined ? Math.round(data.r * 255) : 255
            const g = data.g !== undefined ? Math.round(data.g * 255) : 255
            const b = data.b !== undefined ? Math.round(data.b * 255) : 255
            const hasColorOv = data.r !== undefined || data.g !== undefined || data.b !== undefined

            return (
              <ColorSection
                key={cell.cellKey}
                color={{ r: data.r !== undefined ? r : null, g: data.g !== undefined ? g : null, b: data.b !== undefined ? b : null }}
                hasOverride={hasColorOv}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
                onChange={(nr, ng, nb) => setCellColor(cell.cellKey, nr, ng, nb)}
                onRelease={() => releaseCell(cell.cellKey)}
              />
            )
          }

          case NodeFamily.BEAM: {
            const data = (ov?.payload.family === NodeFamily.BEAM
              ? ov.payload.data
              : {}) as BeamCellPayload

            const hasBeamOv = Object.keys(data).length > 0

            return (
              <BeamSection
                key={cell.cellKey}
                hasOverride={hasBeamOv}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
                onOverrideChange={onOverrideChange ?? (() => {})}
              />
            )
          }

          // KINETIC → dominio del KineticsCathedral, no del Programmer
          case NodeFamily.KINETIC:
            return null

          // ATMOSPHERE → ExtrasSection (legacy, enlazada desde TheProgrammer globalmente)
          case NodeFamily.ATMOSPHERE:
            return null

          default:
            return null
        }
      })}
    </div>
  )
}

