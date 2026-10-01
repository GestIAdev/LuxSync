/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 useOrphanPhantomChannels — WAVE 4734 BATCH 2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hook que extrae los canales "phantom" (custom, rotation, macro, speed,
 * control) de los fixtures seleccionados Y que NO están cubiertos por
 * ninguna CellKey del pipeline Aether.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Arquitectura (3 paths, en orden de prioridad):
 *
 *   PATH 1:   channels[] embebido en FixtureV2 del stageStore
 *   PATH 1.5: libraryStore en RAM (zero IPC — cubre fans, fog, ingenios)
 *   PATH 2:   IPC getFixtureDefinition() como fallback legacy
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Diferencia clave vs. ExtrasSection.tsx (legado):
 *
 *   El hook devuelve SOLO canales phantom ORFANOs — aquellos cuyo
 *   `channelType` NO aparece en los grupos Aether de `aggregatedGroups`.
 *   Los canales gestionados por COLOR / IMPACT / BEAM cells se excluyen
 *   para evitar doble-UI (F4 del blueprint).
 *
 *   Si `aggregatedGroups` está vacío (fixtures sin nodeGraph), todos los
 *   phantoms se devuelven — comportamiento idéntico al legado.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ANTI-SIMULACIÓN: sin Math.random(), sin mocks. Toda resolución es real.
 *
 * @module components/hyperion/controls/useOrphanPhantomChannels
 * @version WAVE 4734-B
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { NodeFamily, cellKeyDeviceId } from '../../../stores/programmer-types'
import type { AggregatedCellGroup } from '../../../stores/programmer-types'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Un canal phantom resuelto listo para UI. */
export interface OrphanPhantom {
  /** Índice DMX del canal en el fixture. */
  readonly channelIndex: number
  /** Label humano: customName > name > type.toUpperCase(). */
  readonly label: string
  /** Tipo canónico del canal (para colorear y discriminar). */
  readonly type: string
  /** Valor DMX por defecto (0-255). */
  readonly defaultValue: number
  /**
   * `true` si el rango 0-127 es CW, 128 es STOP, 129-255 es CCW.
   * La UI mostrará el indicador de dirección y velocidad en lugar de valor crudo.
   */
  readonly continuousRotation: boolean
  /** ID del fixture al que pertenece este canal (para telemetría). */
  readonly fixtureId: string
}

/**
 * 🌫️ WAVE 8412+8415: Resultado clasificado por afinidad con el dispositivo.
 *
 *   - `atmosphereRows`: canales huérfanos de EMISIÓN/fluido (smoke_pump,
 *     smoke_density, 'smoke' crudo, custom llamado "Fog Output"…) →
 *     AtmosphereCard dedicada con slider + BURST (WAVE 8415: un ingenio
 *     hecho en el Channel Rack sin Node Graph debe mostrar su widget).
 *   - `phantomOnly`: canales huérfanos de fixtures SIN afinidad atmosférica
 *     (zoom/prism sueltos, macros de movimiento…) → cajón EXTRAS.
 *   - `deviceExtraRows`: canales huérfanos de fixtures que SÍ tienen nodo
 *     `:atmosphere` o canales atmosféricos propios, pero cuyo offset no fue
 *     absorbido — auxiliares, interlocks, macros del aparato de humo… →
 *     cajón CONTROL & MACROS junto a la FogCard.
 */
export interface OrphanPhantomResult {
  readonly atmosphereRows: readonly OrphanPhantom[]
  readonly phantomOnly: readonly OrphanPhantom[]
  readonly deviceExtraRows: readonly OrphanPhantom[]
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de canal que se consideran "phantom" — NO los maneja ninguna Section
 * atomic (COLOR / IMPACT / BEAM / KINETIC).
 */
const PHANTOM_TYPES = new Set([
  'custom', 'rotation', 'macro', 'speed', 'control',
  // 🌫️ WAVE 8415: tipos/intents atmosféricos. Los canónicos (smoke_pump,
  // fire_valve…) normalmente son absorbidos por el nodo :atmosphere — la
  // exclusión por dmxOffset evita doble-UI. Los crudos ('smoke', 'fire',
  // 'emission') del Channel Rack básico no son reclamados por ninguna
  // familia cuando el fixture no es de tipo atmosférico: sin esto el canal
  // de humo quedaba INVISIBLE en el panel (bug WAVE 8415).
  'smoke', 'smoke_pump', 'smoke_density', 'fan_speed', 'fog', 'haze',
  'fire', 'fire_valve', 'fire_ignite', 'emission', 'emission_gate',
])

/**
 * 🌫️ WAVE 8415: tipos de EMISIÓN/fluido — elegibles para la card dedicada
 * (slider + BURST). Gemelo de EMISSION_CHANNEL_TYPES en useCapabilityCells.
 */
const ATMO_EMISSION_TYPES = new Set<string>([
  'smoke', 'smoke_pump', 'smoke_density', 'fan_speed', 'fog', 'haze',
])

/** Interlocks de seguridad — NUNCA en la card, van a CONTROL & MACROS. */
const ATMO_SAFETY_TYPES = new Set<string>([
  'fire', 'fire_valve', 'fire_ignite', 'emission', 'emission_gate',
])

/** Heurística: canal 'custom' cuyo nombre sugiere emisión atmosférica. */
const EMISSION_NAME_RE = /smoke|fog|haze|pump|emissi/i

/** Tipos de fixture intrínsecamente atmosféricos (para clasificar auxiliares). */
const ATMO_FIXTURE_TYPES = new Set<string>(['fog', 'pyro', 'fan', 'mirror-ball'])

/** TTL de la caché de definiciones IPC (las defs no cambian en runtime). */
const CACHE_TTL_MS = 60_000

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildOrphanFromRaw(raw: Record<string, unknown>, fixtureId: string): OrphanPhantom {
  return {
    channelIndex:       typeof raw.index === 'number'          ? raw.index
                      : typeof raw.channelIndex === 'number'  ? raw.channelIndex
                      : 0,
    label:              typeof raw.customName === 'string' && raw.customName.length > 0 ? raw.customName
                      : typeof raw.name       === 'string' && raw.name.length > 0       ? raw.name
                      : typeof raw.type       === 'string'                               ? raw.type.toUpperCase()
                      : 'UNKNOWN',
    type:               typeof raw.type === 'string' ? raw.type : 'custom',
    defaultValue:       typeof raw.defaultValue === 'number' ? raw.defaultValue : 0,
    continuousRotation: raw.continuousRotation === true,
    fixtureId,
  }
}

/** Merge sin duplicar por channelIndex (el primero gana). */
function mergeNoDup(target: OrphanPhantom[], incoming: OrphanPhantom[]): OrphanPhantom[] {
  const seen = new Set(target.map(p => p.channelIndex))
  const out = target.slice()
  for (const p of incoming) {
    if (!seen.has(p.channelIndex)) {
      seen.add(p.channelIndex)
      out.push(p)
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae los canales phantom ORFANOs de los fixtures seleccionados.
 *
 * @param aggregatedGroups Grupos Aether activos. Se usa para filtrar canales
 *   que YA están cubiertos por una Section atomic. Pasar `[]` devuelve todos.
 *
 * @returns `OrphanPhantomResult` clasificado (`phantomOnly` / `deviceExtraRows`).
 *   La referencia solo cambia cuando la selección o los phantoms reales cambian.
 */
export function useOrphanPhantomChannels(
  aggregatedGroups: readonly AggregatedCellGroup[] = [],
): OrphanPhantomResult {
  const selectedIds = useSelectedArray()

  // ── Stores ────────────────────────────────────────────────────────────────
  const stageFixtures = useStageStore(state => {
    if (state.fixtures && state.fixtures.length > 0) return state.fixtures
    if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) return state.showFile.fixtures
    return [] as unknown[]
  })

  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)

  // ── State ─────────────────────────────────────────────────────────────────
  const [orphans, setOrphans] = useState<readonly OrphanPhantom[]>([])

  // Caché de defs IPC: defId → {phantoms, timestamp}
  const cacheRef = useRef<Map<string, { phantoms: OrphanPhantom[]; ts: number }>>(new Map())

  // Ref estable de stageFixtures (evita re-resolución en cada tick HAL).
  const stageFixturesRef = useRef(stageFixtures)
  useEffect(() => { stageFixturesRef.current = stageFixtures }, [stageFixtures])

  // ── Conjuntos de tipos YA cubiertos por Aether ────────────────────────────
  // Si no hay grupos, todos los phantom tipos son huérfanos.
  // Si hay grupos, excluimos los tipos cuya familia ya tiene cobertura.
  //
  // Mapping familia → tipos que ya cubre:
  //   IMPACT  → dimmer, strobe, shutter, limit
  //   COLOR   → r, g, b, white, amber
  //   BEAM    → gobo, prism, focus, zoom, iris
  //   KINETIC → pan, tilt, speed, rotation, targetX, targetY, targetZ
  //
  // WAVE 4743 FIX Bug #3: cuando hay grupos Aether KINETIC activos, los tipos
  // 'rotation' y 'speed' ya están cubiertos por KineticSection. No deben
  // duplicarse en Extras. El comportamiento legado (sin nodeGraph) se mantiene:
  // si no hay grupos Aether, todos los phantom son huérfanos.
  const coveredTypes = useMemo<Set<string>>(() => {
    if (aggregatedGroups.length === 0) return new Set()
    const covered = new Set<string>()
    for (const group of aggregatedGroups) {
      // NodeFamily.KINETIC — cuando hay células KINETIC activas,
      // los canales 'rotation' y 'speed' ya tienen UI en KineticSection.
      if (group.family === NodeFamily.KINETIC) {
        covered.add('rotation')
        covered.add('speed')
      }
    }
    return covered
  }, [aggregatedGroups])

  // 🌫️ WAVE 8412: cobertura ATMOSPHERE por dispositivo.
  //
  // El nodo `:atmosphere` absorbe canales custom/control/macro/smoke del
  // fixture — sin esta exclusión aparecerían DOS controles (fila phantom +
  // fila de la FogCard). El match es por `dmxOffset` (no por `type`): un
  // fixture puede tener dos canales `custom` y solo uno ser atmosférico.
  //
  // Además registramos QUÉ fixtures tienen nodo atmosférico — sus phantoms
  // residuales se clasifican como `deviceExtraRows` (compartimento
  // QUARANTINE), separados de los phantoms de fixtures sin atmósfera.
  const atmosphereCoverage = useMemo<{
    offsetsByDevice: Map<string, Set<number>>
    deviceIds: Set<string>
  }>(() => {
    const offsetsByDevice = new Map<string, Set<number>>()
    const deviceIds = new Set<string>()
    for (const group of aggregatedGroups) {
      if (group.family !== NodeFamily.ATMOSPHERE || !group.atmosphereChannels) continue
      for (const cellKey of group.cellKeys) {
        const deviceId = cellKeyDeviceId(cellKey)
        deviceIds.add(deviceId)
        let set = offsetsByDevice.get(deviceId)
        if (!set) {
          set = new Set()
          offsetsByDevice.set(deviceId, set)
        }
        for (const ch of group.atmosphereChannels) {
          set.add(ch.dmxOffset)
        }
      }
    }
    return { offsetsByDevice, deviceIds }
  }, [aggregatedGroups])

  // WAVE 7694: Ref estable para coveredTypes — evita que el useEffect
  // se re-ejecute cuando coveredTypes cambia de referencia sin cambiar
  // contenido (causa del loop "Maximum update depth exceeded").
  const coveredTypesRef = useRef(coveredTypes)
  useEffect(() => { coveredTypesRef.current = coveredTypes }, [coveredTypes])
  const atmosphereCoverageRef = useRef(atmosphereCoverage)
  useEffect(() => { atmosphereCoverageRef.current = atmosphereCoverage }, [atmosphereCoverage])

  // ── Resolución de fixtures seleccionados ──────────────────────────────────
  const resolveDefId = useCallback((f: Record<string, unknown>): string | null => {
    const id = f?.profileId || f?.definitionId || f?.fixtureDefId
    return typeof id === 'string' && id.length > 0 ? id : null
  }, [])

  // ── Selección estable como string key (evita re-resolve en tick HAL) ──────
  const selectionKey = JSON.stringify(selectedIds)

  useEffect(() => {
    if (selectedIds.length === 0) {
      setOrphans([])
      return
    }

    let cancelled = false

    const resolve = async () => {
      const currentFixtures = (stageFixturesRef.current as Record<string, unknown>[])
        .filter((f: Record<string, unknown>) => selectedIds.includes(f?.id as string))

      if (currentFixtures.length === 0) {
        setOrphans([])
        return
      }

      // WAVE 7694: Leer coveredTypes del ref estable, no del closure.
      const _coveredTypes = coveredTypesRef.current
      // 🌫️ WAVE 8412: cobertura atmosférica por offset (Map<deviceId, Set<dmxOffset>>).
      const _atmosCoverage = atmosphereCoverageRef.current
      const isCoveredByAtmosphere = (
        ch: Record<string, unknown>,
        fixtureId: string,
        sourceChannels: readonly Record<string, unknown>[],
      ): boolean => {
        const covered = _atmosCoverage.offsetsByDevice.get(fixtureId)
        if (!covered) return false
        const rawIdx = typeof ch.index === 'number'        ? ch.index
                     : typeof ch.channelIndex === 'number' ? ch.channelIndex
                     : -1
        if (rawIdx < 0) return false
        // 🌫️ WAVE 8415: dmxOffset es SIEMPRE 0-based; el index del canal
        // puede ser 1-based (defs FXTParser). Detectar la base desde el
        // array fuente — sin esto un canal 1-based nunca matcheaba y el
        // canal absorbido por :atmosphere se renderizaba dos veces.
        const firstIdx = sourceChannels.length > 0
          ? (typeof sourceChannels[0].index === 'number'
              ? sourceChannels[0].index
              : (sourceChannels[0].channelIndex as number | undefined))
          : undefined
        const offset = firstIdx === 0 ? rawIdx : rawIdx - 1
        return covered.has(offset)
      }

      let accumulated: OrphanPhantom[] = []
      const now = Date.now()

      for (const fixture of currentFixtures) {
        if (cancelled) break
        const fixtureId = fixture.id as string

        // ── PATH 1: channels[] embebido ────────────────────────────────────
        if (Array.isArray(fixture.channels) && fixture.channels.length > 0) {
          const chs = fixture.channels as Record<string, unknown>[]
          const phantoms = chs
            .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !_coveredTypes.has(ch?.type as string) && !isCoveredByAtmosphere(ch, fixtureId, chs))
            .map(ch => buildOrphanFromRaw(ch, fixtureId))
          accumulated = mergeNoDup(accumulated, phantoms)
          continue
        }

        const defId = resolveDefId(fixture)

        // ── PATH 1.5: libraryStore en RAM ──────────────────────────────────
        if (defId) {
          const libEntry = getLibraryFixtureById(defId)
          if (Array.isArray(libEntry?.channels) && libEntry.channels.length > 0) {
            const chs = libEntry.channels as unknown as Record<string, unknown>[]
            const phantoms = chs
              .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !_coveredTypes.has(ch?.type as string) && !isCoveredByAtmosphere(ch, fixtureId, chs))
              .map(ch => buildOrphanFromRaw(ch, fixtureId))
            accumulated = mergeNoDup(accumulated, phantoms)
            continue
          }
        }

        if (!defId) continue

        // ── PATH 2: caché IPC ───────────────────────────────────────────────
        const cached = cacheRef.current.get(defId)
        if (cached && now - cached.ts < CACHE_TTL_MS) {
          accumulated = mergeNoDup(accumulated, cached.phantoms)
          continue
        }

        // ── PATH 2: IPC real ────────────────────────────────────────────────
        try {
          const result = await window.lux?.getFixtureDefinition?.(defId)
          if (!result?.success || !Array.isArray(result.definition?.channels)) {
            cacheRef.current.set(defId, { phantoms: [], ts: now })
            continue
          }
          const chs = result.definition.channels as Record<string, unknown>[]
          const phantoms = chs
            .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !_coveredTypes.has(ch?.type as string) && !isCoveredByAtmosphere(ch, fixtureId, chs))
            .map(ch => buildOrphanFromRaw(ch, fixtureId))
          cacheRef.current.set(defId, { phantoms, ts: now })
          accumulated = mergeNoDup(accumulated, phantoms)
        } catch (err) {
          console.warn(`[useOrphanPhantomChannels] IPC error for "${defId}":`, err)
        }
      }

      if (!cancelled) {
        accumulated.sort((a, b) => a.channelIndex - b.channelIndex)
        setOrphans(Object.freeze(accumulated))
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [selectionKey, resolveDefId, getLibraryFixtureById]) // eslint-disable-line react-hooks/exhaustive-deps

  // 🌫️ WAVE 8412+8415: split por afinidad — en tres compartimentos.
  //   1. Canales de EMISIÓN huérfanos → card atmosférica dedicada.
  //   2. Auxiliares de dispositivos atmosféricos (nodo :atmosphere, type
  //      atmosférico, o con canales de emisión propios) → CONTROL & MACROS.
  //   3. Resto → cajón EXTRAS genérico.
  return useMemo<OrphanPhantomResult>(() => {
    // Fixtures atmosféricos por type o por poseer canales de emisión huérfanos.
    const atmosDeviceIds = new Set<string>(atmosphereCoverage.deviceIds)
    for (const f of stageFixtures as { id?: string; type?: string }[]) {
      if (f?.id && f.type && ATMO_FIXTURE_TYPES.has(f.type)) atmosDeviceIds.add(f.id)
    }
    for (const p of orphans) {
      if (ATMO_EMISSION_TYPES.has(p.type) || (p.type === 'custom' && EMISSION_NAME_RE.test(p.label))) {
        atmosDeviceIds.add(p.fixtureId)
      }
    }

    const atmosphereRows: OrphanPhantom[] = []
    const phantomOnly: OrphanPhantom[] = []
    const deviceExtraRows: OrphanPhantom[] = []
    for (const p of orphans) {
      if (ATMO_SAFETY_TYPES.has(p.type)) {
        // Interlock (fire_valve, emission_gate…) — jamás en la card.
        deviceExtraRows.push(p)
      } else if (ATMO_EMISSION_TYPES.has(p.type) || (p.type === 'custom' && EMISSION_NAME_RE.test(p.label))) {
        atmosphereRows.push(p)
      } else if (atmosDeviceIds.has(p.fixtureId)) {
        deviceExtraRows.push(p)
      } else {
        phantomOnly.push(p)
      }
    }
    return {
      atmosphereRows:  Object.freeze(atmosphereRows),
      phantomOnly:     Object.freeze(phantomOnly),
      deviceExtraRows: Object.freeze(deviceExtraRows),
    }
  }, [orphans, atmosphereCoverage, stageFixtures])
}
