/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧱 CELL ACCORDION — WAVE 4734 BATCH 2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Compound component que envuelve cualquier Section Body con:
 *   - Header semántico (icono + "FAMILY: LABEL") via buildSectionHeaderText
 *   - Animación de expand/collapse con CSS
 *   - Variable CSS --neon-base por family/role (colorea bordes y glow)
 *   - Badge ×N cuando el grupo tiene > 1 fixture (Hive Mind)
 *   - Botón ↺ Release cuando hay override activo
 *
 * El Header NO es responsabilidad de las Sections ya. Las Sections (Bodies)
 * solo aportan el slot interior (sliders, wheels, etc.).
 *
 * Pattern usado — Compound Component:
 *   <CellAccordion group={g} meta={meta} isExpanded={open} onToggle={fn} override={ov}>
 *     <ColorBody ctx={ctx} allCellKeys={group.cellKeys} />
 *   </CellAccordion>
 *
 * CellAccordion.Generic — variante libre para ExtrasAggregator y otros
 * contenedores sin SectionMeta:
 *   <CellAccordion.Generic title="EXTRAS" neonColor="#8b5cf6" isExpanded={e} onToggle={fn}>
 *     ...
 *   </CellAccordion.Generic>
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS BATCH 1:
 *   - buildSectionHeaderText       (cellLabels.ts)
 *   - SectionMeta / SECTION_REGISTRY (cellRouting.ts)
 *
 * @module components/hyperion/controls/CellAccordion
 * @version WAVE 4734-B
 */

import React, { useCallback, useMemo } from 'react'
import { buildSectionHeaderText } from './cellLabels'
import type { SectionMeta } from './cellRouting'
import type { AggregatedCellGroup, CellOverride } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import './CellAccordion.css'

// ─────────────────────────────────────────────────────────────────────────────
// ROLE → NEON COLOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Única fuente de verdad de colores neon por rol.
 * Consolida ROLE_NEON de TheProgrammer.tsx y DeviceCellGroup.tsx (blueprint §6.3).
 */
export const ROLE_NEON: Readonly<Record<string, string>> = Object.freeze({
  master:      '#ff3366',
  wash:        '#36d1ff',
  petal:       '#d946ef',
  beam:        '#facc15',
  rotor:       '#22c55e',
  ambient:     '#8b5cf6',
  primary:     '#22c55e',
  decoration:  '#fb923c',
  unknown:     '#94a3b8',
})

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface CellAccordionProps {
  /** Grupo Aether agregado (Hive Mind). */
  readonly group: AggregatedCellGroup
  /** Metadatos de la sección (título, neon por defecto). */
  readonly meta: SectionMeta
  /** Si el acordeón está abierto. Controlado externamente. */
  readonly isExpanded: boolean
  /** Callback para toggle. */
  readonly onToggle: () => void
  /** Override actual de la primera cellKey (para mostrar badge MANUAL + botón ↺). */
  readonly override: CellOverride | undefined
  /** Slot: el Body de la Section. */
  readonly children: React.ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const CellAccordionBase: React.FC<CellAccordionProps> = ({
  group,
  meta,
  isExpanded,
  onToggle,
  override,
  children,
}) => {
  const { title, sublabel } = useMemo(
    () => buildSectionHeaderText(meta.title, group.label),
    [meta.title, group.label],
  )

  const neonColor = ROLE_NEON[group.role] ?? meta.defaultNeon

  const hasOverride = override !== undefined

  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useProgrammerStore.getState()
    for (const key of group.cellKeys) {
      store.releaseCell(key)
    }
  }, [group.cellKeys])

  return (
    <div
      className={`cell-accordion ${isExpanded ? 'cell-accordion--expanded' : 'cell-accordion--collapsed'} ${hasOverride ? 'cell-accordion--active' : ''}`}
      style={{ '--neon-base': neonColor } as React.CSSProperties}
    >
      {/* ── HEADER ── */}
      <div className="cell-accordion__header" onClick={onToggle} role="button" aria-expanded={isExpanded}>
        <div className="cell-accordion__title-row">
          <span className="cell-accordion__chevron">{isExpanded ? '▼' : '▶'}</span>

          {/* Neon dot por rol */}
          <span className="cell-accordion__neon-dot" aria-hidden="true" />

          {/* Texto: "INTENSITY: PÉTALO 1" */}
          <span className="cell-accordion__title">{title}</span>
          <span className="cell-accordion__sublabel">: {sublabel}</span>

          {/* Badge ×N — solo cuando hay más de un fixture (Hive Mind) */}
          {group.cellCount > 1 && (
            <span className="cell-accordion__hive-badge" title={`${group.cellCount} fixtures`}>
              ×{group.cellCount}
            </span>
          )}
        </div>

        {/* Release button */}
        <div className="cell-accordion__actions">
          {hasOverride && (
            <button
              className="cell-accordion__release-btn"
              onClick={handleRelease}
              title="Release to AI control"
              type="button"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* ── BODY SLOT ── */}
      {isExpanded && (
        <div className="cell-accordion__body">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC VARIANT — para ExtrasAggregator y contenedores ad-hoc
// ─────────────────────────────────────────────────────────────────────────────

export interface CellAccordionGenericProps {
  /** Título del header (ya en uppercase). */
  readonly title: string
  /** Sub-etiqueta opcional (ej: número de phantoms). */
  readonly sublabel?: string
  /** Color neon para --neon-base. */
  readonly neonColor?: string
  /** Si hay algún override activo (controla badge MANUAL). */
  readonly hasOverride?: boolean
  /** Callback de release (si `hasOverride` y se provee, muestra el botón ↺). */
  readonly onRelease?: () => void
  readonly isExpanded: boolean
  readonly onToggle: () => void
  readonly children: React.ReactNode
}

const CellAccordionGeneric: React.FC<CellAccordionGenericProps> = ({
  title,
  sublabel,
  neonColor = '#94a3b8',
  hasOverride = false,
  onRelease,
  isExpanded,
  onToggle,
  children,
}) => {
  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRelease?.()
  }, [onRelease])

  return (
    <div
      className={`cell-accordion cell-accordion--generic ${isExpanded ? 'cell-accordion--expanded' : 'cell-accordion--collapsed'} ${hasOverride ? 'cell-accordion--active' : ''}`}
      style={{ '--neon-base': neonColor } as React.CSSProperties}
    >
      <div className="cell-accordion__header" onClick={onToggle} role="button" aria-expanded={isExpanded}>
        <div className="cell-accordion__title-row">
          <span className="cell-accordion__chevron">{isExpanded ? '▼' : '▶'}</span>
          <span className="cell-accordion__neon-dot" aria-hidden="true" />
          <span className="cell-accordion__title">{title}</span>
          {sublabel && <span className="cell-accordion__sublabel">: {sublabel}</span>}
        </div>
        <div className="cell-accordion__actions">
          {hasOverride && onRelease && (
            <button
              className="cell-accordion__release-btn"
              onClick={handleRelease}
              title="Release to AI control"
              type="button"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="cell-accordion__body">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — Compound component con .Generic adjunto
// ─────────────────────────────────────────────────────────────────────────────

export const CellAccordion = Object.assign(CellAccordionBase, {
  Generic: CellAccordionGeneric,
})
