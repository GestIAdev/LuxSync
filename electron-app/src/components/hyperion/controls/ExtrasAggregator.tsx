/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 EXTRAS AGGREGATOR — WAVE 4734-F
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cajón ordenado que recoge TODO lo que el CellRouter no renderizó:
 *
 *   A) Grupos ATMOSPHERE (delegatedToExtras=true en SECTION_REGISTRY).
 *      → AtmosphereCellRow por cada grupo (slider 0-100% → setCellExtra).
 *
 *   B) Canales phantom orfanos (custom/macro/control/speed/rotation) de los
 *      fixtures seleccionados que NO están asignados a ninguna CellKey.
 *      → PhantomChannelRow por cada canal (slider 0-255 → setExtra).
 *
 * Renderiza NULL si no hay nada que mostrar (grupos ATMOSPHERE vacíos Y
 * orphanPhantoms vacíos). Blueprint §8 + §9.R7: SIEMPRE al final + colapsado
 * por defecto.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ANTI-SIMULACIÓN: sin Math.random(). Todos los valores vienen del pipeline
 * Aether o del probe IPC real.
 *
 * @module components/hyperion/controls/ExtrasAggregator
 * @version WAVE 4734-F
 */

import React, { useCallback, useState } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { AggregatedCellGroup } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { CellAccordion } from './CellAccordion'
import { useOrphanPhantomChannels, type OrphanPhantom } from './useOrphanPhantomChannels'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un valor DMX (0-255) para display:
 * - Rotación continua: muestra DIR + velocidad %
 * - Normal: muestra valor crudo
 */
function formatPhantomValue(value: number, continuousRotation: boolean): string {
  if (!continuousRotation) return String(value)
  if (value < 126) return `CW ${Math.round((1 - value / 127) * 100)}%`
  if (value > 130) return `CCW ${Math.round(((value - 128) / 127) * 100)}%`
  return 'STOP'
}

/**
 * Color neon por tipo de canal phantom (WAVE 2084.12 cyberpunk color coding).
 * Returns [hex, r, g, b]
 */
function phantomTypeColor(type: string): [string, number, number, number] {
  switch (type) {
    case 'rotation':
    case 'speed':
      return ['#f59e0b', 245, 158, 11]
    case 'custom':
      return ['#d946ef', 217, 70, 239]
    case 'macro':
    case 'control':
      return ['#22c55e', 34, 197, 94]
    default:
      return ['#22d3ee', 34, 211, 238]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE CELL ROW
// ─────────────────────────────────────────────────────────────────────────────

interface AtmosphereCellRowProps {
  readonly group: AggregatedCellGroup
}

const AtmosphereCellRow: React.FC<AtmosphereCellRowProps> = ({ group }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(group.cellKeys[0]))
  const hasOverride = ov !== undefined

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val   = parseInt(e.target.value, 10)
    const store = useProgrammerStore.getState()
    // setCellExtra(cellKey, channelKey, value0_255) — ATMOSPHERE genérico.
    // Usamos la label como channelKey (igual que el legado para ATMOSPHERE).
    for (const k of group.cellKeys) {
      store.setCellExtra(k, group.label, val)
    }
  }, [group.cellKeys, group.label])

  // Leer valor actual desde el override (si existe)
  const currentVal = ov?.payload.family === NodeFamily.ATMOSPHERE
    ? ov.payload.data.get(group.label)
    : undefined
  const displayVal = currentVal !== undefined ? Math.round(currentVal * 255) : 0

  return (
    <div className={`extras-atm-row ${hasOverride ? 'extras-atm-row--active' : ''}`}>
      <div className="extras-atm-row__header">
        <span className="extras-atm-row__label">{group.label}</span>
        {group.cellCount > 1 && (
          <span className="extras-atm-row__badge">×{group.cellCount}</span>
        )}
        <span className="extras-atm-row__value">{displayVal}</span>
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={displayVal}
        onChange={handleChange}
        className="extras-atm-row__slider"
        aria-label={`${group.label} level`}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM CHANNEL ROW
// ─────────────────────────────────────────────────────────────────────────────

interface PhantomChannelRowProps {
  readonly phantom: OrphanPhantom
}

const PhantomChannelRow: React.FC<PhantomChannelRowProps> = ({ phantom }) => {
  // Estado local del valor (no hay store para orfanos — van directo por setExtra).
  const [value, setValue] = useState<number>(phantom.defaultValue)

  const [hexColor, cR, cG, cB] = phantomTypeColor(phantom.type)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    setValue(v)

    // WAVE 3503: Para custom/unknown, key = label. Para el resto, key = type.
    const isNameKeyed = phantom.type === 'custom' || phantom.type === 'unknown'
    const channelKey  = isNameKeyed ? phantom.label : phantom.type

    // Canales orfanos van por setExtra (fixture-scope, no por cellKey).
    useProgrammerStore.getState().setExtra(channelKey, v)
  }, [phantom.label, phantom.type])

  return (
    <div
      className={`phantom-row ${phantom.continuousRotation ? 'phantom-row--rotation' : ''}`}
      style={{
        '--pc':           hexColor,
        '--pc-border':    `rgba(${cR},${cG},${cB},0.4)`,
        '--pc-glow':      `rgba(${cR},${cG},${cB},0.12)`,
        '--pc-label':     `rgba(${cR},${cG},${cB},0.85)`,
      } as React.CSSProperties}
    >
      <div className="phantom-row__header">
        <span className="phantom-row__label">{phantom.label}</span>
        <span className="phantom-row__value">
          {formatPhantomValue(value, phantom.continuousRotation)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={handleChange}
        className="phantom-row__slider"
        aria-label={phantom.label}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAS AGGREGATOR — componente principal
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtrasAggregatorProps {
  /** Todos los grupos del pipeline (el aggregator filtra familia ATMOSPHERE). */
  readonly groups: readonly AggregatedCellGroup[]
}

export const ExtrasAggregator: React.FC<ExtrasAggregatorProps> = ({ groups }) => {
  // Blueprint §9.R7: Colapsado por defecto.
  const [isExpanded, setIsExpanded] = useState(false)
  const handleToggle = useCallback(() => setIsExpanded(prev => !prev), [])

  // A) Grupos ATMOSPHERE (familia delegada a extras por cellRouting.ts)
  const atmosphereGroups = groups.filter(g => g.family === NodeFamily.ATMOSPHERE)

  // B) Canales phantom orfanos de los fixtures seleccionados
  const orphanPhantoms = useOrphanPhantomChannels(groups)

  // Nada que renderizar
  if (atmosphereGroups.length === 0 && orphanPhantoms.length === 0) return null

  const totalChannels = atmosphereGroups.length + orphanPhantoms.length
  const sublabel      = `${totalChannels} channel${totalChannels !== 1 ? 's' : ''}`

  return (
    <CellAccordion.Generic
      title="EXTRAS"
      sublabel={sublabel}
      neonColor="#8b5cf6"
      isExpanded={isExpanded}
      onToggle={handleToggle}
    >
      {atmosphereGroups.length > 0 && (
        <div className="extras-aggregator__atmosphere-section">
          <div className="extras-aggregator__section-header">ATMOSPHERE</div>
          {atmosphereGroups.map(g => (
            <AtmosphereCellRow key={g.cellKeys[0]} group={g} />
          ))}
        </div>
      )}

      {orphanPhantoms.length > 0 && (
        <div className="extras-aggregator__phantom-section">
          <div className="extras-aggregator__section-header">PHANTOM CHANNELS</div>
          {orphanPhantoms.map(p => (
            <PhantomChannelRow
              key={`${p.fixtureId}:${p.channelIndex}`}
              phantom={p}
            />
          ))}
        </div>
      )}
    </CellAccordion.Generic>
  )
}
