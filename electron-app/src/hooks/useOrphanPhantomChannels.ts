/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎣 USE ORPHAN PHANTOM CHANNELS — WAVE 4734 BATCH 1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Recolecta los canales DMX de tipo phantom (`custom`, `macro`, `control`,
 * `speed`, `rotation`) que NO están cubiertos por ningún nodo `output_dmx`
 * del `nodeGraph` del fixture seleccionado.
 *
 * Estos huérfanos son los que el futuro <ExtrasAggregator> (BATCH 2) mostrará
 * en el "cajón EXTRAS" del Programmer, sin duplicar la lógica de las cells
 * estructuradas (color/impact/beam/kinetic ya cubiertas por sus secciones).
 *
 * REGLAS:
 *   1. Si el fixture trae `nodeGraph.nodes[]` con `output_dmx`, los offsets
 *      cubiertos por esos nodos se descartan (la cell estructurada se
 *      encarga). Esto evita duplicar el Spinner si ya tiene un nodo KINETIC.
 *   2. Si NO hay `nodeGraph` (legacy plano), TODOS los canales phantom se
 *      consideran huérfanos.
 *   3. Canales con `type` fuera de `PHANTOM_CHANNEL_TYPES` se omiten — los
 *      maneja su section dedicada o se descartan como `unknown`.
 *
 * RESOLUCIÓN DE CHANNELS (3 paths, en orden de preferencia):
 *   PATH 1   — `stageFixture.channels[]` inline.
 *   PATH 1.5 — `libraryStore.getFixtureById(profileId).channels[]`.
 *   (PATH 2 — IPC fallback NO implementado en BATCH 1; lo cubre <ExtrasSection>
 *    legacy mientras esté vivo. Sonnet lo migrará en BATCH-E si hace falta.)
 *
 * @module hooks/useOrphanPhantomChannels
 * @version WAVE 4734-A
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'

import { useStageStore } from '../stores/stageStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSelectedArray } from '../stores/selectionStore'
import { resolveCellLabel } from '../components/hyperion/controls/cellLabels'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de canal considerados "phantom" — no manejados por
 * IntensitySection / ColorSection / BeamSection / KineticSection.
 *
 * Subset estricto de `ChannelType` de `FixtureDefinition.ts`.
 */
const PHANTOM_CHANNEL_TYPES = new Set<PhantomChannelType>([
  'custom',
  'macro',
  'control',
  'speed',
  'rotation',
])

/** Discriminated union de los tipos phantom — útil para narrowing aguas abajo. */
export type PhantomChannelType =
  | 'custom'
  | 'macro'
  | 'control'
  | 'speed'
  | 'rotation'

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC OUTPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una entrada por canal phantom huérfano, lista para que el <ExtrasAggregator>
 * la renderice como `<PhantomChannelRow>` (BATCH 2).
 */
export interface OrphanPhantom {
  /** ID del fixture origen — sirve para dispatch IPC al hardware. */
  readonly fixtureId: string
  /** Nombre humano del fixture (header del subgrupo). */
  readonly fixtureName: string
  /** Índice DMX 0-based dentro del fixture. */
  readonly channelIndex: number
  /** Etiqueta humana del canal (`customName ?? name ?? type.toUpperCase()`). */
  readonly label: string
  /** Tipo del canal — driver de la UI (slider lineal vs spinner bipolar). */
  readonly type: PhantomChannelType
  /** Valor DMX por defecto del perfil (0-255). */
  readonly defaultValue: number
  /** `true` si es rotación continua (0-127 CW, 128 stop, 129-255 CCW). */
  readonly continuousRotation: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SHAPES INTERNOS (defensivos — los datos vienen de JSON/IPC con shape laxo)
// ─────────────────────────────────────────────────────────────────────────────

interface RawChannel {
  index?: number
  channelIndex?: number
  name?: string
  customName?: string
  type?: string
  defaultValue?: number
  continuousRotation?: boolean
}

interface RawNode {
  id?: string
  type?: string
  config?: {
    dmxOffset?: number
    nodeType?: string
    is16bit?: boolean
  }
}

interface RawNodeGraph {
  nodes?: RawNode[]
}

interface RawFixture {
  id?: string
  name?: string
  profileId?: string
  definitionId?: string
  fixtureDefId?: string
  channels?: RawChannel[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — extracción defensiva
// ─────────────────────────────────────────────────────────────────────────────

/** Resuelve el ID de la definición de fixture con cascada blind. */
function resolveDefId(fixture: RawFixture): string | null {
  return fixture?.profileId ?? fixture?.definitionId ?? fixture?.fixtureDefId ?? null
}

/**
 * Calcula el set de `dmxOffset` cubiertos por nodos `output_dmx` en el
 * nodeGraph. Si el nodeGraph no existe o no tiene nodos válidos, devuelve
 * un set vacío (= todos los phantoms se considerarán huérfanos).
 *
 * Cuenta también `is16bit` → cubre el offset siguiente (LSB).
 */
function computeCoveredOffsets(nodeGraph: RawNodeGraph | undefined): Set<number> {
  const covered = new Set<number>()
  const nodes = nodeGraph?.nodes
  if (!Array.isArray(nodes)) return covered

  for (const node of nodes) {
    // Aceptamos tanto `node.type === 'output_dmx'` como `config.nodeType === 'output_dmx'`
    // — la forma del JSON ha variado entre waves.
    const isOutputDmx =
      node?.type === 'output_dmx' || node?.config?.nodeType === 'output_dmx'
    if (!isOutputDmx) continue

    const offset = node?.config?.dmxOffset
    if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) continue

    covered.add(offset)
    if (node.config?.is16bit === true) {
      covered.add(offset + 1)
    }
  }

  return covered
}

/** Type-guard: `value` es uno de los tipos phantom soportados. */
function isPhantomType(value: unknown): value is PhantomChannelType {
  return typeof value === 'string' && PHANTOM_CHANNEL_TYPES.has(value as PhantomChannelType)
}

/**
 * Convierte un `RawChannel` en `OrphanPhantom` si cumple ser phantom + no
 * estar cubierto por el nodeGraph. Retorna `null` si no aplica.
 */
function buildOrphanFromChannel(
  channel: RawChannel,
  fixtureId: string,
  fixtureName: string,
  coveredOffsets: Set<number>,
): OrphanPhantom | null {
  if (!isPhantomType(channel.type)) return null

  const rawIdx = channel.index ?? channel.channelIndex
  if (typeof rawIdx !== 'number' || !Number.isFinite(rawIdx) || rawIdx < 0) return null
  const channelIndex = Math.floor(rawIdx)

  if (coveredOffsets.has(channelIndex)) return null

  const labelCandidate =
    channel.customName ?? channel.name ?? channel.type.toUpperCase()

  return {
    fixtureId,
    fixtureName,
    channelIndex,
    label: resolveCellLabel(labelCandidate),
    type: channel.type,
    defaultValue:
      typeof channel.defaultValue === 'number' && Number.isFinite(channel.defaultValue)
        ? Math.max(0, Math.min(255, channel.defaultValue))
        : 0,
    continuousRotation: channel.continuousRotation === true,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook que devuelve los canales phantom huérfanos de los fixtures actualmente
 * seleccionados, listos para renderizar en el <ExtrasAggregator>.
 *
 * Reactivo a:
 *   - `useSelectionStore` (selectedIds)
 *   - `useStageStore`     (fixtures DNA)
 *   - `useLibraryStore`   (definitions con nodeGraph)
 *
 * Memoización: el resultado solo cambia cuando cambian las inputs relevantes
 * (no en cada tick de HAL). `JSON.stringify` de selectedIds en la dependencia
 * evita re-cálculos por refs nuevas pero misma identidad lógica.
 *
 * Output deterministicamente ordenado por `(fixtureId, channelIndex)` para
 * que el render sea estable entre renders.
 */
export function useOrphanPhantomChannels(): readonly OrphanPhantom[] {
  const selectedIds = useSelectedArray()

  // Selector estable sobre stageFixtures — copia el patrón ya usado en
  // useCapabilityCells.ts y ExtrasSection.tsx.
  const stageFixtures = useStageStore(
    useShallow(state => {
      if (state.fixtures && state.fixtures.length > 0) return state.fixtures
      if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) {
        return state.showFile.fixtures
      }
      return [] as unknown[]
    }),
  )

  // Solo necesitamos la función — referencia estable.
  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)
  const libraryLastLoadTime = useLibraryStore(state => state.lastLoadTime)

  const selectionKey = selectedIds.join(',')

  return useMemo<readonly OrphanPhantom[]>(() => {
    if (selectedIds.length === 0) return Object.freeze([])

    const fixturesById = new Map<string, RawFixture>()
    for (const f of stageFixtures as RawFixture[]) {
      if (f && typeof f.id === 'string') {
        fixturesById.set(f.id, f)
      }
    }

    const orphans: OrphanPhantom[] = []

    for (const fixtureId of selectedIds) {
      const stageFix = fixturesById.get(fixtureId)
      if (!stageFix) continue

      const fixtureName =
        typeof stageFix.name === 'string' && stageFix.name.length > 0
          ? stageFix.name
          : fixtureId

      // ─── Resolución de channels[] (PATH 1 → 1.5) ──────────────────────
      let channels: RawChannel[] | null = null
      let nodeGraph: RawNodeGraph | undefined

      // PATH 1: inline en el FixtureV2.
      if (Array.isArray(stageFix.channels) && stageFix.channels.length > 0) {
        channels = stageFix.channels
      }

      // PATH 1.5: library store en RAM. También nos da el nodeGraph (clave).
      const defId = resolveDefId(stageFix)
      if (defId) {
        const libEntry = getLibraryFixtureById(defId) as
          | { channels?: RawChannel[]; nodeGraph?: RawNodeGraph }
          | null
        if (libEntry) {
          if (!channels && Array.isArray(libEntry.channels) && libEntry.channels.length > 0) {
            channels = libEntry.channels
          }
          if (libEntry.nodeGraph && typeof libEntry.nodeGraph === 'object') {
            nodeGraph = libEntry.nodeGraph
          }
        }
      }

      if (!channels || channels.length === 0) continue

      // ─── Set de offsets cubiertos por output_dmx ──────────────────────
      const covered = computeCoveredOffsets(nodeGraph)

      for (const channel of channels) {
        const orphan = buildOrphanFromChannel(channel, fixtureId, fixtureName, covered)
        if (orphan !== null) orphans.push(orphan)
      }
    }

    // Orden determinista: por fixtureId asc, luego por channelIndex asc.
    orphans.sort((a, b) => {
      if (a.fixtureId !== b.fixtureId) {
        return a.fixtureId < b.fixtureId ? -1 : 1
      }
      return a.channelIndex - b.channelIndex
    })

    return Object.freeze(orphans)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, stageFixtures, getLibraryFixtureById, libraryLastLoadTime])
}
