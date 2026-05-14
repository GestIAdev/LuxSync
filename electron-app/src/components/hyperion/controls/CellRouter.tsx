/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 CELL ROUTER — WAVE 4735: THE WIRING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Componente de enrutado declarativo. Sustituye el bloque `switch/map` legacy
 * de TheProgrammer.tsx por un pipeline limpio:
 *
 *   aggregatedGroups
 *     → filtrar por SECTION_REGISTRY.canRender + delegatedToExtras
 *     → envolver cada grupo en <CellAccordion> + <*Body> correspondiente
 *     → pintar <ExtrasAggregator> al final (ATMOSPHERE + orphan phantoms)
 *
 * Gestiona su propio estado de acordeón exclusivo (un solo grupo abierto a
 * la vez). TheProgrammer pasa `groups` y desaparece del circuito de render.
 *
 * Arquitectura de suscripción eficiente:
 *   Cada grupo delega en <RoutedCell>, que lee solo el override de su propia
 *   primaryKey desde el store. Evita re-renders en cascada al mutar cualquier
 *   celda ajena.
 *
 * @module components/hyperion/controls/CellRouter
 * @version WAVE 4735-A
 */

import React, { useState, useCallback, memo } from 'react'
import { useProgrammerStore } from '../../../stores/programmerStore'
import type { AggregatedCellGroup, CellKey, CellOverride } from '../../../stores/programmer-types'
import { SECTION_REGISTRY } from './cellRouting'
import type { SectionMeta } from './cellRouting'
import { CellAccordion } from './CellAccordion'
import { IntensityBody } from './IntensitySection'
import { ColorBody } from './ColorSection'
import { BeamBody } from './BeamSection'
import { KineticBody } from './KineticSection'
import { ExtrasAggregator } from './ExtrasAggregator'

// ─────────────────────────────────────────────────────────────────────────────
// ROUTED CELL — sub-componente por grupo
// ─────────────────────────────────────────────────────────────────────────────

interface RoutedCellProps {
  group:      AggregatedCellGroup
  meta:       SectionMeta
  isExpanded: boolean
  onToggle:   () => void
}

/**
 * Renderiza un único grupo como <CellAccordion> + <*Body>.
 *
 * Suscripción fina al store: solo lee el override de `primaryKey`, no el Map
 * completo. Así, mutaciones en otras células no provocan re-render aquí.
 */
const RoutedCell: React.FC<RoutedCellProps> = memo(({ group, meta, isExpanded, onToggle }) => {
  const primaryKey = group.cellKeys[0] as CellKey
  const override   = useProgrammerStore(s => s.cellOverrides.get(primaryKey)) as CellOverride | undefined

  // Gate: familia marcada como delegada a extras → no renderizar acordeón autónomo
  if (meta.delegatedToExtras) return null
  // Gate: predicado de familia (anti-fantasma bug F1)
  if (!meta.canRender(group, override)) return null

  let body: React.ReactNode
  switch (meta.componentKey) {
    case 'intensity':
      body = (
        <IntensityBody
          primaryKey={primaryKey}
          allCellKeys={group.cellKeys}
          nodeIds={group.nodeIds}
        />
      )
      break
    case 'color':
      body = (
        <ColorBody
          primaryKey={primaryKey}
          allCellKeys={group.cellKeys}
        />
      )
      break
    case 'beam':
      body = (
        <BeamBody
          primaryKey={primaryKey}
          allCellKeys={group.cellKeys}
        />
      )
      break
    case 'kinetic':
      body = (
        <KineticBody
          primaryKey={primaryKey}
          allCellKeys={group.cellKeys}
        />
      )
      break
    default:
      return null
  }

  return (
    <CellAccordion
      group={group}
      meta={meta}
      isExpanded={isExpanded}
      onToggle={onToggle}
      override={override}
    >
      {body}
    </CellAccordion>
  )
})
RoutedCell.displayName = 'RoutedCell'

// ─────────────────────────────────────────────────────────────────────────────
// CELL ROUTER — componente público
// ─────────────────────────────────────────────────────────────────────────────

export interface CellRouterProps {
  /** Grupos agregados producidos por useAggregatedCapabilityCells. */
  readonly groups: readonly AggregatedCellGroup[]
}

/**
 * Punto de entrada del sistema de routing de células.
 *
 * Gestiona estado de acordeón exclusivo (un solo grupo abierto a la vez).
 * La llamada a <ExtrasAggregator> recibe el array completo de grupos;
 * internamente filtra por NodeFamily.ATMOSPHERE + orphan phantoms.
 */
export const CellRouter: React.FC<CellRouterProps> = ({ groups }) => {
  const [activeSection, setActiveSection] = useState<string>('')

  const toggleSection = useCallback((key: string) => {
    setActiveSection(prev => (prev === key ? '' : key))
  }, [])

  return (
    <>
      {groups.map(group => {
        const meta = SECTION_REGISTRY[group.family]
        if (!meta) return null

        return (
          <RoutedCell
            key={group.groupKey}
            group={group}
            meta={meta}
            isExpanded={activeSection === group.groupKey}
            onToggle={() => toggleSection(group.groupKey)}
          />
        )
      })}

      {/* ExtrasAggregator — siempre al final, conforme al blueprint §9.R7 */}
      <ExtrasAggregator groups={groups} />
    </>
  )
}

export default CellRouter
