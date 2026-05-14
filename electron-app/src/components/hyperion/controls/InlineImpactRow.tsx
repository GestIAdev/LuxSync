/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ INLINE IMPACT ROW — WAVE 4734-D
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mini-fila de control de intensidad embebida dentro de un SectionBody
 * que NO es IMPACT (ej: ColorBody de nodos Wash/Petal con dimmer físico).
 *
 * Arquitectura (blueprint §7.2):
 *   > Sub-rows inyectables. Cada *SectionBody consulta su override y renderiza
 *   > extras según los canales presentes.
 *
 * Usa `setCellColorImpact` (WAVE 4734-D) que escribe en `ColorCellPayload.dimmer`
 * sin cambiar de familia, conservando el discriminante y evitando el family
 * mismatch del store (a diferencia de `setCellImpact` puro).
 *
 * Hive Mind: aplica a TODOS los cellKeys del grupo (allCellKeys), igual que
 * el resto de setters de las Sections.
 *
 * @module components/hyperion/controls/InlineImpactRow
 * @version WAVE 4734-D
 */

import React, { useCallback } from 'react'
import type { CellKey } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import './InlineImpactRow.css'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Canales de intensidad que pueden embeberse en un nodo COLOR (WAVE 4732.4). */
export type EmbeddedImpactChannel = 'dimmer' | 'strobe' | 'shutter'

export interface InlineImpactRowProps {
  /** CellKey principal del grupo (determina qué override se lee para el valor). */
  readonly primaryKey: CellKey
  /** Todos los cellKeys del grupo — el setter dispara a todos (Hive Mind). */
  readonly allCellKeys: readonly CellKey[]
  /** Canal a controlar en esta fila. */
  readonly channel: EmbeddedImpactChannel
  /** Etiqueta visible en UI (ej: "Cell Dimmer", "Strobe", "Shutter"). */
  readonly label: string
  /**
   * Valor actual en 0-100 (leído por el padre del override y pasado aquí).
   * Si es `undefined`, la fila muestra estado inactivo (sin override).
   */
  readonly value: number | undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONOS MÍNIMOS (sin LuxIcons para no crear dependencia circular)
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<EmbeddedImpactChannel, string> = {
  dimmer:  '○',
  strobe:  '⚡',
  shutter: '◐',
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export const InlineImpactRow: React.FC<InlineImpactRowProps> = ({
  primaryKey,
  allCellKeys,
  channel,
  label,
  value,
}) => {
  const hasOverride = value !== undefined
  const sliderVal   = value ?? 0

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pct   = Number(e.target.value)
    const store = useProgrammerStore.getState()
    for (const k of allCellKeys) {
      store.setCellColorImpact(k, channel, pct)
    }
  }, [allCellKeys, channel])

  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Release específico del canal: no liberamos todo el override COLOR,
    // solo volvemos a aplicar un override sin este canal.
    // Por ahora: no-op informativo; en Batch 3 se añadirá partial release.
    // Full release lo gestiona el CellAccordion.
  }, [])

  return (
    <div className={`inline-impact-row inline-impact-row--${channel} ${hasOverride ? 'inline-impact-row--active' : ''}`}>
      <div className="inline-impact-row__header">
        <span className="inline-impact-row__icon" aria-hidden="true">
          {CHANNEL_ICON[channel]}
        </span>
        <span className="inline-impact-row__label">{label}</span>
        <span className="inline-impact-row__value">
          {hasOverride ? (channel === 'dimmer' ? `${Math.round(sliderVal)}%` : (sliderVal === 0 ? 'OFF' : `${Math.round(sliderVal)}%`)) : '—'}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={sliderVal}
        onChange={handleChange}
        className={`inline-impact-row__slider inline-impact-row__slider--${channel}`}
        aria-label={label}
      />

      {hasOverride && (
        <div className="inline-impact-row__badge">
          {label.toUpperCase()} MANUAL
        </div>
      )}
    </div>
  )
}
