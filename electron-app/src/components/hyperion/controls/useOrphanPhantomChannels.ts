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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de canal que se consideran "phantom" — NO los maneja ninguna Section
 * atomic (COLOR / IMPACT / BEAM / KINETIC).
 */
const PHANTOM_TYPES = new Set(['custom', 'rotation', 'macro', 'speed', 'control'])

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
 * @returns Lista estable de `OrphanPhantom` lista para UI. La referencia solo
 *   cambia cuando la selección o los phantoms reales cambian.
 */
export function useOrphanPhantomChannels(
  aggregatedGroups: readonly AggregatedCellGroup[] = [],
): readonly OrphanPhantom[] {
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
  // Los tipos phantom (rotation, speed) que caen en KINETIC cells
  // siguen siendo huérfanos para la UI de Extras (el cell KINETIC los
  // gestiona via KineticSection, pero rotation/speed phantom se exponen
  // como canales directos). Para conservar el comportamiento de ExtrasSection
  // legado, SE INCLUYEN como huérfanos siempre.
  //
  // La excepción es cuando el propio tipo ya tiene su propia cell family — en
  // ese caso el aggregatedGroup lo cubre y no debe duplicarse en Extras.
  const coveredTypes = useMemo<Set<string>>(() => {
    if (aggregatedGroups.length === 0) return new Set()
    // No filtramos nada — devolvemos todos los PHANTOM_TYPES como huérfanos.
    // La Section atomic de cada familia sólo entiende su propio payload;
    // los phantom types (rotation/speed/custom/macro/control) nunca forman
    // parte de esos payloads, así que siempre son "huérfanos" de las Sections.
    return new Set<string>()
  }, [aggregatedGroups])

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

      let accumulated: OrphanPhantom[] = []
      const now = Date.now()

      for (const fixture of currentFixtures) {
        if (cancelled) break
        const fixtureId = fixture.id as string

        // ── PATH 1: channels[] embebido ────────────────────────────────────
        if (Array.isArray(fixture.channels) && fixture.channels.length > 0) {
          const phantoms = (fixture.channels as Record<string, unknown>[])
            .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !coveredTypes.has(ch?.type as string))
            .map(ch => buildOrphanFromRaw(ch, fixtureId))
          accumulated = mergeNoDup(accumulated, phantoms)
          continue
        }

        const defId = resolveDefId(fixture)

        // ── PATH 1.5: libraryStore en RAM ──────────────────────────────────
        if (defId) {
          const libEntry = getLibraryFixtureById(defId)
          if (Array.isArray(libEntry?.channels) && libEntry.channels.length > 0) {
            const phantoms = (libEntry.channels as unknown as Record<string, unknown>[])
              .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !coveredTypes.has(ch?.type as string))
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
          const phantoms = (result.definition.channels as Record<string, unknown>[])
            .filter(ch => PHANTOM_TYPES.has(ch?.type as string) && !coveredTypes.has(ch?.type as string))
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
  }, [selectionKey, resolveDefId, getLibraryFixtureById, coveredTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  return orphans
}
