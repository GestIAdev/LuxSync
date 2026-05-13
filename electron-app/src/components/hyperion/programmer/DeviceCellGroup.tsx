/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 DEVICE CELL GROUP — WAVE 4726: CLEAN SWEEP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wrapper de células de capacidad para UN device.
 * Recibe las `cells[]` del hook `useCapabilityCells` y renderiza
 * las secciones atómicas (IntensitySection | ColorSection | BeamSection)
 * pasando `ctx` directamente — cada sección lee/escribe el store por sí sola.
 *
 * SISTEMA NEON:
 *   CSS custom property `--neon-base` inyectada en el wrapper,
 *   heredada por las secciones hijas sin prop drilling.
 *
 * @module components/hyperion/programmer/DeviceCellGroup
 * @version WAVE 4726
 */

import React, { useState, useCallback } from 'react'
import type { CellDescriptor, CapabilityContext } from '../../../stores/programmer-types'
import { NodeFamily } from '../../../stores/programmer-types'
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
}) => {
  const [localSection, setLocalSection] = useState<string | null>(null)

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
        // 🚨 WAVE 4728 FIX B: usar cellKey por celda en lugar de family agrupada.
        // Antes: `${deviceId}:${cell.family}` colisionaba para fixtures multi-célula
        // como el Tungsten (4 COLOR cells = 1 sectionKey compartida → toggle roto).
        // Ahora cada acordeón mantiene su propio toggle.
        const sectionKey = cell.cellKey
        const isExpanded = localSection === sectionKey

        switch (cell.family) {
          case NodeFamily.IMPACT:
            return (
              <IntensitySection
                key={cell.cellKey}
                ctx={cell as unknown as CapabilityContext<NodeFamily.IMPACT>}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
              />
            )

          case NodeFamily.COLOR:
            return (
              <ColorSection
                key={cell.cellKey}
                ctx={cell as unknown as CapabilityContext<NodeFamily.COLOR>}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
              />
            )

          case NodeFamily.BEAM:
            return (
              <BeamSection
                key={cell.cellKey}
                ctx={cell as unknown as CapabilityContext<NodeFamily.BEAM>}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(sectionKey)}
              />
            )

          // KINETIC → dominio del KineticsCathedral
          case NodeFamily.KINETIC:
            return null

          // ATMOSPHERE → ExtrasSection (global en TheProgrammer)
          case NodeFamily.ATMOSPHERE:
            return null

          default:
            return null
        }
      })}
    </div>
  )
}

