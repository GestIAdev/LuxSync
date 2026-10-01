/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️ ATMOSPHERE DEVICE CARD — WAVE 8412: FOG WIDGET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tarjeta de control dedicada para dispositivos atmosféricos REALES
 * (fog / haze / fan / pyro / spark). Reemplaza el fallback engañoso a
 * PAR CAN: sin DIM, sin RGB, sin óptica — solo los canales de emisión
 * que el dispositivo declara en su nodo `:atmosphere`.
 *
 * BINDING:
 *   Cada fila escribe `setCellExtra(cellKey, ch.key, value0_255)` donde
 *   `ch.key` es el `chDef.type` real del canal ('smoke_pump', 'custom',
 *   'emission_gate'…) — la única clave que el NodeResolver resuelve contra
 *   `channelValues[type]`. La fila genérica de ExtrasAggregator escribía
 *   `group.label` ('Extras') — una key muerta que nunca llegaba a DMX.
 *
 * CONTROLES:
 *   - Slider 0-100% por canal.
 *   - Botón BURST (disparo rápido momentáneo: 255 mientras se mantiene,
 *     0 al soltar) solo en canales de emisión/fluido — NUNCA en interlocks
 *     de seguridad (fire_valve, fire_ignite, emission_gate).
 *
 * ICONOGRAFÍA:
 *   Hexágono + círculo interior — la misma identidad que Erebus usa para
 *   efectos atmosféricos (SymbolLayer → EffectSymbol).
 *
 * ANTI-SIMULACIÓN: el valor mostrado viene del cellOverride del store
 * (lo que el operador escribió). Nada se inventa.
 *
 * @module components/hyperion/controls/AtmosphereDeviceCard
 * @version WAVE 8412
 */

import React, { useCallback } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { AggregatedCellGroup, AtmosphereChannelRef } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import './TheProgrammer.css'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/** Neon atmosférico — el violeta del cajón EXTRAS / role 'ambient'. */
const ATMOS_NEON = '#8b5cf6'

/** Título de la tarjeta según el atmosType del nodo. */
const ATMOS_CARD_TITLES: Readonly<Record<string, string>> = Object.freeze({
  fog:    'FOG MACHINE',
  haze:   'HAZE MACHINE',
  fan:    'FAN',
  pyro:   'PYRO',
  spark:  'SPARK',
  laser:  'EMISSION',
  custom: 'ATMOSPHERE',
})

/**
 * Canales a los que se les ofrece el disparo rápido BURST.
 * Los interlocks de seguridad (fire_valve, fire_ignite, emission_gate)
 * quedan fuera: disparo momentáneo + fail-closed no se mezclan.
 */
const BURST_CHANNEL_TYPES = new Set<string>([
  'smoke_pump',
  'smoke_density',
  'fan_speed',
  'custom',
])

// ─────────────────────────────────────────────────────────────────────────────
// ICONO — Hexágono + círculo interior (identidad Erebus para atmosféricos)
// ─────────────────────────────────────────────────────────────────────────────

/** 🌫️ WAVE 8415: exportado para la card de canales atmosféricos huérfanos. */
export const AtmosphereGlyph: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="atmos-card__glyph"
  >
    <polygon
      points="12,2.5 20.2,7.25 20.2,16.75 12,21.5 3.8,16.75 3.8,7.25"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.6" fill="currentColor" opacity="0.9" />
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL ROW — slider 0-100% + BURST momentáneo
// ─────────────────────────────────────────────────────────────────────────────

interface AtmosphereChannelRowProps {
  readonly group: AggregatedCellGroup
  readonly channel: AtmosphereChannelRef
}

const AtmosphereChannelRow: React.FC<AtmosphereChannelRowProps> = ({ group, channel }) => {
  // Hive Mind: todas las cellKeys del grupo comparten payload — basta la primera.
  const ov = useProgrammerStore(s => s.cellOverrides.get(group.cellKeys[0]))

  const writeAll = useCallback((value0_255: number) => {
    const store = useProgrammerStore.getState()
    for (const k of group.cellKeys) {
      store.setCellExtra(k, channel.key, value0_255)
    }
  }, [group.cellKeys, channel.key])

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    writeAll(parseInt(e.target.value, 10))
  }, [writeAll])

  const handleBurstDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    writeAll(255)
  }, [writeAll])

  const handleBurstUp = useCallback(() => {
    writeAll(0)
  }, [writeAll])

  const stored = ov?.payload.family === NodeFamily.ATMOSPHERE
    ? ov.payload.data.get(channel.key)
    : undefined
  const value255 = stored !== undefined ? Math.round(stored * 255) : 0
  const valuePct = Math.round((value255 / 255) * 100)
  const isActive = value255 > 0

  return (
    <div className={`atmos-channel ${isActive ? 'atmos-channel--active' : ''}`}>
      <div className="atmos-channel__header">
        <span className="atmos-channel__label">{channel.label}</span>
        {BURST_CHANNEL_TYPES.has(channel.key) && (
          <button
            type="button"
            className="atmos-channel__burst"
            onPointerDown={handleBurstDown}
            onPointerUp={handleBurstUp}
            onPointerLeave={handleBurstUp}
            title="Momentary full output (hold)"
          >
            BURST
          </button>
        )}
      </div>
      <div
        className="intensity-slider-container"
        style={{ '--neon-base': ATMOS_NEON } as React.CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={255}
          value={value255}
          onChange={handleSlider}
          className="intensity-slider"
          aria-label={`${channel.label} level`}
        />
        <div className="intensity-value">{valuePct}%</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE DEVICE CARD
// ─────────────────────────────────────────────────────────────────────────────

export interface AtmosphereDeviceCardProps {
  /** Grupo agregado de familia ATMOSPHERE correspondiente a un dispositivo real. */
  readonly group: AggregatedCellGroup
  /**
   * Canales operativos a mostrar en la card (salidas de emisión/fluido).
   * Los interlocks (fire_valve, control, macro…) los filtra ExtrasAggregator
   * hacia QUARANTINE — nunca llegan aquí.
   */
  readonly channels: readonly AtmosphereChannelRef[]
}

export const AtmosphereDeviceCard: React.FC<AtmosphereDeviceCardProps> = ({ group, channels }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(group.cellKeys[0]))

  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useProgrammerStore.getState()
    for (const key of group.cellKeys) {
      store.releaseCell(key)
    }
  }, [group.cellKeys])

  const hasOverride = ov !== undefined

  if (channels.length === 0) return null

  const primaryAtmosType = group.atmosTypes?.find(t => t !== 'custom') ?? group.atmosTypes?.[0] ?? 'custom'
  const title = ATMOS_CARD_TITLES[primaryAtmosType] ?? 'ATMOSPHERE'

  return (
    <div
      className={`atmos-card ${hasOverride ? 'atmos-card--active' : ''}`}
      style={{ '--neon-base': ATMOS_NEON } as React.CSSProperties}
    >
      <div className="atmos-card__header">
        <AtmosphereGlyph size={15} />
        <span className="atmos-card__title">{title}</span>
        {group.deviceCount > 1 && (
          <span className="atmos-card__badge" title={`${group.deviceCount} devices`}>
            ×{group.deviceCount}
          </span>
        )}
        {hasOverride && (
          <button
            type="button"
            className="cell-accordion__release-btn"
            onClick={handleRelease}
            title="Release to AI control"
          >
            ↺
          </button>
        )}
      </div>
      <div className="atmos-card__body">
        {channels.map(ch => (
          <AtmosphereChannelRow key={ch.key} group={group} channel={ch} />
        ))}
      </div>
    </div>
  )
}

export default AtmosphereDeviceCard
