/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️ EXTRAS AGGREGATOR — WAVE 8412: FOG WIDGET INTEGRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Distribuye lo que el CellRouter no renderizó en tres compartimentos:
 *
 *   1. ATMOSPHERE DEVICE CARD — dispositivos atmosféricos REALES
 *      (fog / haze / fan / pyro / spark). Si el grupo ATMOSPHERE contiene al
 *      menos un canal de emisión (`isEmission`), renderiza una tarjeta
 *      dedicada SIEMPRE VISIBLE — sin RGB, sin DIM, sin fallback a PAR.
 *      Cada canal escribe su `chDef.type` real ('smoke_pump', …).
 *
 *   2. CONTROL & MACROS (colapsado por defecto) — canales auxiliares /
 *      interlocks del dispositivo atmosférico (antes "QUARANTINE",
 *      renombrado WAVE 8415 — la etiqueta alarmaba a los clientes; la
 *      lógica de aislamiento interna no cambia):
 *        · canales ATMOSPHERE sin isEmission (fire_valve, fire_ignite,
 *          emission_gate, control, macro…)
 *        · canales phantom residuales del MISMO dispositivo (custom/macro/
 *          control no absorbidos por el nodo `:atmosphere`)
 *
 *   3. EXTRAS (colapsado por defecto) — canales phantom de fixtures SIN
 *      nodo atmosférico (zoom/prism sueltos, macros de movimiento…).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ANTI-SIMULACIÓN: sin Math.random(). Todos los valores vienen del pipeline
 * Aether o del probe IPC real.
 *
 * @module components/hyperion/controls/ExtrasAggregator
 * @version WAVE 8412
 */

import React, { useCallback, useMemo, useState } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { AggregatedCellGroup, AtmosphereChannelRef } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { CellAccordion } from './CellAccordion'
import { AtmosphereDeviceCard, AtmosphereGlyph } from './AtmosphereDeviceCard'
import { useOrphanPhantomChannels, type OrphanPhantom } from './useOrphanPhantomChannels'
import './TheProgrammer.css'

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
function phantomTypeColor(type: string): string {
  switch (type) {
    case 'rotation':
    case 'speed':
      return '#f59e0b'
    case 'custom':
      return '#d946ef'
    case 'macro':
    case 'control':
      return '#22c55e'
    default:
      return '#22d3ee'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE QUARANTINE ROW — canal real 0-255 con su key verdadera
// ─────────────────────────────────────────────────────────────────────────────

interface AtmosphereChannelRowProps {
  readonly group: AggregatedCellGroup
  readonly channel: AtmosphereChannelRef
}

const AtmosphereChannelRow: React.FC<AtmosphereChannelRowProps> = ({ group, channel }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(group.cellKeys[0]))

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    const store = useProgrammerStore.getState()
    for (const k of group.cellKeys) {
      // 🌫️ WAVE 8412: escribir la key REAL del canal (chDef.type), nunca
      // `group.label` — 'Extras' era una key muerta que el resolver ignoraba.
      store.setCellExtra(k, channel.key, v)
    }
  }, [group.cellKeys, channel.key])

  const stored = ov?.payload.family === NodeFamily.ATMOSPHERE
    ? ov.payload.data.get(channel.key)
    : undefined
  const value255 = stored !== undefined ? Math.round(stored * 255) : 0

  return (
    <div className="extras-atm-row" style={{ '--neon-base': '#8b5cf6' } as React.CSSProperties}>
      <div className="extras-atm-row__header">
        <span className="extras-atm-row__label">{channel.label}</span>
      </div>
      <div className="intensity-slider-container">
        <input
          type="range"
          min={0}
          max={255}
          value={value255}
          onChange={handleChange}
          className="intensity-slider"
          aria-label={`${channel.label} level`}
        />
        <div className="intensity-value">{value255}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM CHANNEL ROW — canales sin celda Aether (setExtra fixture-scope)
// ─────────────────────────────────────────────────────────────────────────────

interface PhantomChannelRowProps {
  readonly phantom: OrphanPhantom
}

const PhantomChannelRow: React.FC<PhantomChannelRowProps> = ({ phantom }) => {
  // Hydrate desde programmerStore — los valores sobreviven a cambios de vista.
  const isNameKeyed = phantom.type === 'custom' || phantom.type === 'unknown'
  const channelKey  = isNameKeyed ? phantom.label : phantom.type

  const storedValue = useProgrammerStore(s => {
    for (const ov of s.fixtureOverrides.values()) {
      const found = ov.extras?.get(channelKey)
      if (found !== undefined) return Math.round(found * 255)
    }
    return undefined
  })

  const value = storedValue ?? phantom.defaultValue
  const hexColor = phantomTypeColor(phantom.type)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    // Canales huérfanos van por setExtra (fixture-scope, no por cellKey).
    useProgrammerStore.getState().setExtra(channelKey, v)
  }, [channelKey])

  return (
    <div
      className={`phantom-row ${phantom.continuousRotation ? 'phantom-row--rotation' : ''}`}
    >
      <div className="phantom-row__header">
        <span className="phantom-row__label" style={{ color: hexColor }}>{phantom.label}</span>
      </div>
      <div
        className="intensity-slider-container"
        style={{ '--neon-base': hexColor } as React.CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={255}
          value={value}
          onChange={handleChange}
          className="intensity-slider"
          aria-label={phantom.label}
        />
        <div className="intensity-value" style={{ color: hexColor }}>
          {formatPhantomValue(value, phantom.continuousRotation)}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌫️ WAVE 8415: ORPHAN ATMOSPHERE CARD — canal de emisión sin nodo Aether
//
// Una máquina de humo creada en el Channel Rack básico (sin Node Graph, sin
// perfil de librería) produce un canal huérfano 'smoke'/'smoke_pump'. Sin esta
// card el panel quedaba vacío: el canal no era phantom (no estaba en
// PHANTOM_TYPES) ni celda (sin nodo). Escribe por `setExtra` — el bridge lo
// enruta al nodeId `${fixtureId}:atmosphere` que el backend sí construye
// porque el pipeline absorbe los tipos atmosféricos aunque el fixture sea
// 'generic'.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intents crudos → tipo de canal canónico. Gemelo de CHANNEL_TYPE_ALIASES
 * (NodeExtractionPipeline): el resolver backend escribe por chDef.type ya
 * canonicalizado, así que la key huérfana debe ser la canónica.
 */
const ORPHAN_ATMO_KEY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  smoke:    'smoke_pump',
  fog:      'smoke_pump',
  haze:     'smoke_pump',
  density:  'smoke_density',
  fire:     'fire_valve',
  flame:    'fire_valve',
  ignite:   'fire_ignite',
  ignition: 'fire_ignite',
  emission: 'emission_gate',
})

/** Canales huérfanos a los que se les ofrece BURST (emisión, no interlocks). */
const ORPHAN_BURST_TYPES = new Set<string>([
  'smoke', 'smoke_pump', 'smoke_density', 'fan_speed', 'fog', 'haze', 'custom',
])

interface OrphanAtmosphereRowProps {
  readonly phantom: OrphanPhantom
}

const OrphanAtmosphereRow: React.FC<OrphanAtmosphereRowProps> = ({ phantom }) => {
  const isNameKeyed = phantom.type === 'custom' || phantom.type === 'unknown'
  const channelKey  = isNameKeyed
    ? phantom.label
    : (ORPHAN_ATMO_KEY_ALIASES[phantom.type] ?? phantom.type)

  const storedValue = useProgrammerStore(s => {
    for (const ov of s.fixtureOverrides.values()) {
      const found = ov.extras?.get(channelKey)
      if (found !== undefined) return Math.round(found * 255)
    }
    return undefined
  })
  const value255 = storedValue ?? phantom.defaultValue
  const valuePct = Math.round((value255 / 255) * 100)
  const isActive = value255 > 0

  const write = useCallback((v: number) => {
    useProgrammerStore.getState().setExtra(channelKey, v)
  }, [channelKey])
  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    write(parseInt(e.target.value, 10))
  }, [write])
  const handleBurstDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    write(255)
  }, [write])
  const handleBurstUp = useCallback(() => write(0), [write])

  return (
    <div className={`atmos-channel ${isActive ? 'atmos-channel--active' : ''}`}>
      <div className="atmos-channel__header">
        <span className="atmos-channel__label">{phantom.label}</span>
        {ORPHAN_BURST_TYPES.has(phantom.type) && (
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
        style={{ '--neon-base': '#8b5cf6' } as React.CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={255}
          value={value255}
          onChange={handleSlider}
          className="intensity-slider"
          aria-label={`${phantom.label} level`}
        />
        <div className="intensity-value">{valuePct}%</div>
      </div>
    </div>
  )
}

interface OrphanAtmosphereCardProps {
  readonly fixtureId: string
  readonly channels: readonly OrphanPhantom[]
}

/** Card atmosférica para canales huérfanos — misma identidad que AtmosphereDeviceCard. */
const OrphanAtmosphereCard: React.FC<OrphanAtmosphereCardProps> = ({ fixtureId, channels }) => {
  if (channels.length === 0) return null
  return (
    <div className="atmos-card" style={{ '--neon-base': '#8b5cf6' } as React.CSSProperties}>
      <div className="atmos-card__header">
        <AtmosphereGlyph size={15} />
        <span className="atmos-card__title">ATMOSPHERE</span>
      </div>
      <div className="atmos-card__body">
        {channels.map(p => (
          <OrphanAtmosphereRow key={`${fixtureId}:${p.channelIndex}`} phantom={p} />
        ))}
      </div>
    </div>
  )
}

/**
 * 🌫️ WAVE 8412: canales que NUNCA van a la tarjeta principal — interlocks de
 * seguridad e instrumentación. Viven en CONTROL & MACROS incluso en
 * dispositivos reales (un fire_valve no es un "Smoke slider").
 */
const QUARANTINE_CHANNEL_TYPES = new Set<string>([
  'fire_valve',
  'fire_ignite',
  'emission_gate',
  'control',
  'macro',
])

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAS AGGREGATOR — componente principal
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtrasAggregatorProps {
  /** Todos los grupos del pipeline (el aggregator filtra familia ATMOSPHERE). */
  readonly groups: readonly AggregatedCellGroup[]
}

export const ExtrasAggregator: React.FC<ExtrasAggregatorProps> = ({ groups }) => {
  // Blueprint §9.R7: cajones colapsados por defecto.
  const [isQuarantineExpanded, setQuarantineExpanded] = useState(false)
  const [isExtrasExpanded, setExtrasExpanded] = useState(false)
  const toggleQuarantine = useCallback(() => setQuarantineExpanded(p => !p), [])
  const toggleExtras = useCallback(() => setExtrasExpanded(p => !p), [])

  // A) Grupos ATMOSPHERE (familia delegada a extras por cellRouting.ts)
  const atmosphereGroups = useMemo(
    () => groups.filter(g => g.family === NodeFamily.ATMOSPHERE),
    [groups],
  )

  /**
   * Split por grupo:
   *  - `isDevice`: atmosType real (fog/haze/fan/pyro/spark/laser) o al menos
   *    un canal con intent de emisión → la máquina es un ingenio real.
   *  - `cardChannels`: salidas operativas (smoke/fan/custom…) — van a la card.
   *  - `quarantineChannels`: interlocks/auxiliares. En grupos NO-device
   *    (nodo custom residual) TODOS los canales van a quarantine — sin card.
   *  - Un device cuyos canales son TODOS interlocks (piro puro con solo
   *    fire_valve+fire_ignite) no lleva card vacía: todo a quarantine.
   */
  const isDeviceGroup = useCallback((g: AggregatedCellGroup): boolean =>
    !!g.atmosTypes?.some(t => t !== 'custom') || !!g.atmosphereChannels?.some(c => c.isEmission),
  [])
  const cardChannelsOf = useCallback((g: AggregatedCellGroup): readonly AtmosphereChannelRef[] =>
    (g.atmosphereChannels ?? []).filter(c => !QUARANTINE_CHANNEL_TYPES.has(c.key)),
  [])
  const quarantineChannelsOf = useCallback((g: AggregatedCellGroup): readonly AtmosphereChannelRef[] => {
    const chans = g.atmosphereChannels ?? []
    if (isDeviceGroup(g) && cardChannelsOf(g).length > 0) {
      return chans.filter(c => QUARANTINE_CHANNEL_TYPES.has(c.key))
    }
    return chans
  }, [isDeviceGroup, cardChannelsOf])

  const deviceCards = useMemo(
    () =>
      atmosphereGroups
        .filter(g => isDeviceGroup(g) && cardChannelsOf(g).length > 0)
        .map(g => ({ group: g, channels: cardChannelsOf(g) })),
    [atmosphereGroups, isDeviceGroup, cardChannelsOf],
  )
  const quarantineRows = useMemo(() => {
    const list: { group: AggregatedCellGroup; channels: readonly AtmosphereChannelRef[] }[] = []
    for (const g of atmosphereGroups) {
      const chans = quarantineChannelsOf(g)
      if (chans.length > 0) list.push({ group: g, channels: chans })
    }
    return list
  }, [atmosphereGroups, quarantineChannelsOf])

  // B) Canales phantom clasificados por afinidad con el dispositivo.
  // WAVE 8412: el hook recibe los grupos para excluir por dmxOffset los
  // canales ya absorbidos por el nodo `:atmosphere` (anti doble-UI).
  // WAVE 8415: `atmosphereRows` — canales de emisión huérfanos (rack básico
  // sin Node Graph) que obtienen su propia card con BURST.
  const { atmosphereRows, phantomOnly, deviceExtraRows } = useOrphanPhantomChannels(groups)

  // 🌫️ WAVE 8415: cards huérfanas agrupadas por fixture (una por ingenio).
  const orphanCards = useMemo(() => {
    const byFixture = new Map<string, OrphanPhantom[]>()
    for (const p of atmosphereRows) {
      const list = byFixture.get(p.fixtureId)
      if (list) list.push(p)
      else byFixture.set(p.fixtureId, [p])
    }
    return [...byFixture.entries()].map(([fixtureId, channels]) => ({ fixtureId, channels }))
  }, [atmosphereRows])

  // Nada que renderizar
  const quarantineCount =
    quarantineRows.reduce((n, g) => n + g.channels.length, 0) + deviceExtraRows.length
  if (deviceCards.length === 0 && orphanCards.length === 0 && quarantineCount === 0 && phantomOnly.length === 0) return null

  return (
    <>
      {/* 1️⃣ TARJETAS DE DISPOSITIVO ATMOSFÉRICO — siempre visibles */}
      {deviceCards.map(({ group, channels }) => (
        <AtmosphereDeviceCard key={group.groupKey} group={group} channels={channels} />
      ))}
      {orphanCards.map(({ fixtureId, channels }) => (
        <OrphanAtmosphereCard key={`orphan-atmos:${fixtureId}`} fixtureId={fixtureId} channels={channels} />
      ))}

      {/* 2️⃣ CONTROL & MACROS — interlocks y auxiliares del dispositivo */}
      {quarantineCount > 0 && (
        <CellAccordion.Generic
          title="CONTROL & MACROS"
          sublabel={`${quarantineCount} channel${quarantineCount !== 1 ? 's' : ''}`}
          neonColor="#f59e0b"
          isExpanded={isQuarantineExpanded}
          onToggle={toggleQuarantine}
        >
          {quarantineRows.map(({ group, channels }) =>
            channels.map(ch => (
              <AtmosphereChannelRow key={`${group.groupKey}:${ch.key}`} group={group} channel={ch} />
            )),
          )}
          {deviceExtraRows.map(p => (
            <PhantomChannelRow key={`${p.fixtureId}:${p.channelIndex}`} phantom={p} />
          ))}
        </CellAccordion.Generic>
      )}

      {/* 3️⃣ EXTRAS — phantoms de fixtures sin nodo atmosférico */}
      {phantomOnly.length > 0 && (
        <CellAccordion.Generic
          title="EXTRAS"
          sublabel={`${phantomOnly.length} channel${phantomOnly.length !== 1 ? 's' : ''}`}
          neonColor="#8b5cf6"
          isExpanded={isExtrasExpanded}
          onToggle={toggleExtras}
        >
          {phantomOnly.map(p => (
            <PhantomChannelRow key={`${p.fixtureId}:${p.channelIndex}`} phantom={p} />
          ))}
        </CellAccordion.Generic>
      )}
    </>
  )
}

export default ExtrasAggregator
