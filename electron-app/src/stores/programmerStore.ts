/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 PROGRAMMER STORE — WAVE 4529 → WAVE 4724: CAMALEÓN MULTI-CELL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estado centralizado del Programmer. Reemplaza los useState locales
 * dispersos en TheProgrammer.tsx y sus secciones hijas.
 *
 * PRINCIPIO: La UI habla humano (%, grados, 0-255).
 *            El store normaliza a 0-1 internamente.
 *            El ProgrammerAetherBridge lee los valores normalizados.
 *
 * ARQUITECTURA WAVE 4724 (Camaleón Foundation):
 *   Coexisten DOS capas mientras la UI migra:
 *
 *   1. LEGACY (fixture-flat): `fixtureOverrides` + `dirtyFamilies`.
 *      Setters: setDimmer, setColor, setBeam, setExtra, setPosition...
 *      Granularidad: 1 override por (fixture, familia) — un fixture entero
 *      no puede tener 3 colores distintos por pétalo.
 *      Estado: ESTABLE. Lo consumen los .tsx existentes.
 *
 *   2. CELL (multi-célula): `cellOverrides` + `dirtyCells` + `pendingClearNodeIds`.
 *      Setters: setCellColor, setCellImpact, setCellBeam, setCellKinetic, setCellExtra.
 *      Granularidad: 1 override por nodo Aether (CellKey = `<deviceId>:<nodeLabel>`).
 *      Permite controlar pétalo 1, pétalo 2, wash y rayo de un Tungsteno
 *      independientemente sin colisiones.
 *      Estado: NUEVO. Será consumido por la próxima ola del Camaleón.
 *
 *   PRECEDENCIA EN EL BRIDGE:
 *     El bridge da prioridad a la capa CELL. Los nodeIds cubiertos por
 *     cellOverrides se EXCLUYEN del path legacy en el mismo tick para
 *     evitar dobles escrituras. La capa legacy queda como fallback para
 *     fixtures que aún no se hayan registrado en la capa cell.
 *
 * ZERO-ALLOC EN HOT PATH:
 *   Las CellKey y los arrays de nodeIds se pre-construyen al registrar la
 *   selección (`registerFixtureCells`). El bridge a 44Hz NUNCA construye
 *   strings ni arrays — solo itera Map/Set con `for...of`.
 *
 * @module stores/programmerStore
 * @version WAVE 4724
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Target3D } from '../engine/movement/InverseKinematicsEngine'

// ── WAVE 4724: Capa Multi-Cell ───────────────────────────────────────────────
import { NodeFamily } from '../core/aether/types'
import type { DeviceId, NodeId } from '../core/aether/types'
import type {
  CellKey,
  CellOverride,
  CellOverridePayload,
  CellDescriptor,
  ColorCellPayload,
  ImpactCellPayload,
  BeamCellPayload,
  KineticCellPayload,
  ImpactChannelName,
  ColorChannelName,
  BeamChannelName,
  KineticChannelName,
} from './programmer-types'

// Re-export para que los consumidores tengan un único entrypoint
export type {
  CellKey,
  CellOverride,
  CellDescriptor,
  CellOverridePayload,
  ColorCellPayload,
  ImpactCellPayload,
  BeamCellPayload,
  KineticCellPayload,
  ImpactChannelName,
  ColorChannelName,
  BeamChannelName,
  KineticChannelName,
} from './programmer-types'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Familias de canales que el bridge conoce */
export type ProgrammerFamily = 'IMPACT' | 'COLOR' | 'KINETIC' | 'BEAM' | 'EXTRAS'

type DisplayScalar = number | null

type DisplayColor = {
  r: number | null
  g: number | null
  b: number | null
}

/**
 * Overrides normalizados (0-1) para un fixture.
 * null = canal no en override (AI controla).
 */
export interface ProgrammerOverrides {
  // IMPACT family
  dimmer: number | null
  strobe: number | null
  shutter: number | null
  limit: number | null  // Inhibit limit 0-1 — enviado vía IPC dedicado lux:aether:setInhibitLimit (WAVE 4531)

  // COLOR family
  red: number | null
  green: number | null
  blue: number | null
  white: number | null
  amber: number | null

  // KINETIC family
  pan: number | null    // 0-1 (0-540° → /540)
  tilt: number | null   // 0-1 (0-270° → /270)
  speed: number | null
  targetX: number | null
  targetY: number | null
  targetZ: number | null

  // BEAM family
  gobo: number | null
  prism: number | null
  focus: number | null
  zoom: number | null
  iris: number | null

  // EXTRAS (phantom channels) — channelKey → normalized 0-1
  extras: Map<string, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE + ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

interface ProgrammerState {
  /** Overrides per fixture (sparse — solo fixtures con overrides activos) */
  fixtureOverrides: Map<string, ProgrammerOverrides>

  /** Qué familias tienen datos nuevos para el bridge */
  dirtyFamilies: Set<ProgrammerFamily>

  /** IDs de los fixtures actualmente seleccionados */
  activeFixtureIds: string[]

  // ── Display values (raw, sin normalizar — para alimentar la UI) ──
  displayDimmer: DisplayScalar   // 0-100 | null = MIXED
  displayStrobe: DisplayScalar   // 0-100 | null = MIXED
  displayLimit: DisplayScalar    // 0-100 | null = MIXED
  displayColor: DisplayColor     // 0-255 | null por canal = MIXED

  // ─── WAVE 4724: CELL LAYER (Multi-Cell Foundation) ────────────────────────

  /**
   * Map<CellKey, CellOverride> — Overrides por célula de capacidad.
   *
   * Granularidad: 1 entrada por nodo Aether activo (no por fixture).
   * Vacío = ningún override manual a nivel cell. La capa legacy
   * `fixtureOverrides` actúa como fallback en el bridge.
   *
   * INVARIANTE: las CellKey aquí almacenadas son las MISMAS instancias
   * de string que se construyeron en `registerFixtureCells` — no se
   * recrean en setters ni en el bridge.
   */
  cellOverrides: Map<CellKey, CellOverride>

  /**
   * Set<CellKey> — Celdas con cambios pendientes de flush al NodeArbiter.
   * El bridge la consume vía `consumeDirtyCells` tras un flush exitoso.
   */
  dirtyCells: Set<CellKey>

  /**
   * Set<NodeId> — NodeIds que el bridge debe limpiar explícitamente
   * (clearManualOverrides) en el próximo tick. Se llena cuando una cell
   * se libera (`releaseCell`/`releaseDevice`/`releaseAllCells`) y se
   * vacía con `consumePendingClearNodeIds` tras flush exitoso.
   *
   * Pre-extraída como nodeIds para que el bridge NO tenga que parsear
   * CellKey ni reconstruir nodeIds en hot path.
   */
  pendingClearNodeIds: Set<NodeId>

  /**
   * Map<CellKey, CellDescriptor> — Catálogo COMPLETO de células registradas.
   *
   * Es la fuente de verdad de qué nodos representa cada CellKey:
   *   registry.get(key).nodeIds  → NodeId[] reales (precomputado)
   *   registry.get(key).deviceId → DeviceId padre
   *   registry.get(key).family   → NodeFamily de los nodos
   *
   * INVARIANTE: una CellKey siempre debe estar en `cellRegistry` ANTES de
   * que un setter cell-* la toque. Si no lo está, el setter es no-op.
   *
   * Lo popula `registerFixtureCells` con los descriptors completos resueltos
   * por la UI desde el nodeGraph. El bridge no consulta este Map — los
   * nodeIds viven duplicados dentro de cada CellOverride para evitar lookups
   * en hot path.
   */
  cellRegistry: Map<CellKey, CellDescriptor>

  /**
   * Map<DeviceId, readonly CellKey[]> — Índice secundario device → cells.
   * Derivado de `cellRegistry` para acelerar `releaseDevice()` y
   * `unregisterDeviceCells()` a O(1) lookup + O(K) walk donde K =
   * células del device.
   *
   * Las arrays de CellKey son inmutables tras registro — pre-construidas
   * y congeladas con `Object.freeze`.
   */
  cellsByDevice: Map<DeviceId, readonly CellKey[]>
}

interface ProgrammerActions {
  /** Sincroniza la selección activa. Limpia overrides de fixtures deseleccionados. */
  syncSelection: (fixtureIds: string[]) => void

  /**
   * WAVE 4653: Hidrata estado local desde snapshot L2 del NodeArbiter.
   * No marca dirty flags: solo refleja estado ya existente en backend.
   */
  hydrateFromL2: (
    fixtureIds: string[],
    overridesByNodeId: Record<string, Record<string, number> | null>,
  ) => void

  /** Set dimmer para todos los fixtures activos (value 0-100%) */
  setDimmer: (percent: number) => void

  /** Release dimmer → AI controla */
  releaseDimmer: () => void

  /** Set strobe para todos los fixtures activos (value 0-100%) */
  setStrobe: (percent: number) => void

  /** Release strobe */
  releaseStrobe: () => void

  /** Set inhibit limit (value 0-100%) */
  setLimit: (percent: number) => void

  /** Release inhibit limit */
  releaseLimit: () => void

  /** Set color RGB (r, g, b en 0-255) */
  setColor: (r: number, g: number, b: number) => void

  /** Release color → AI controla */
  releaseColor: () => void

  /** Set posición pan/tilt (pan 0-540°, tilt 0-270°) */
  setPosition: (pan: number, tilt: number) => void

  /** Set target espacial en metros para KINETIC (ruta IK pura) */
  setSpatialPosition: (target: Target3D) => void

  /** Set posición individual por fixture (para formation mode) */
  setPositionPerFixture: (positions: Array<{ fixtureId: string; pan: number; tilt: number }>) => void

  /** Release posición */
  releasePosition: () => void

  /** Set velocidad cinemática (percent 0-100) → normalizado 0-1 → L2 KINETIC 44Hz */
  setKineticSpeed: (percent: number) => void

  /** Release velocidad cinemática */
  releaseKineticSpeed: () => void

  /** Set beam channel (channel key, value 0-255) */
  setBeam: (channel: 'gobo' | 'prism' | 'focus' | 'zoom' | 'iris', value: number) => void

  /** Release todos los canales beam */
  releaseBeam: () => void

  /** Set phantom/extra channel (channelKey = label o type, value 0-255) */
  setExtra: (channelKey: string, value: number) => void

  /** Release todos los phantom channels */
  releaseExtras: () => void

  /** Release TODAS las familias para los fixtures activos (UNLOCK ALL) */
  releaseAll: () => void

  /** El bridge llama esto tras hacer flush de las dirty families */
  consumeDirty: () => void

  /** Limpia solo las familias enviadas con éxito (evita borrar cambios nuevos). */
  consumeDirtyFamilies: (families: ProgrammerFamily[]) => void

  // ─── WAVE 4724: CELL LAYER ACTIONS ────────────────────────────────────────

  /**
   * Registra el catálogo de células para los fixtures seleccionados.
   *
   * La UI llama esto tras resolver los nodos del nodeGraph para los
   * `selectedFixtureIds`. El store memoriza qué células existen por device
   * (`cellsByDevice`) para acelerar `releaseDevice()` y `releaseAllCells()`.
   *
   * NO crea overrides: solo registra el "directorio" de células disponibles.
   * Las CellKey y los nodeIds[] llegan PRE-CONSTRUIDOS — esta función no
   * concatena strings ni asigna arrays nuevos.
   */
  registerFixtureCells: (descriptors: readonly CellDescriptor[]) => void

  /**
   * Borra el catálogo de células de un device y libera todos sus overrides.
   * Útil cuando el operador deselecciona o el showfile cambia.
   */
  unregisterDeviceCells: (deviceId: DeviceId) => void

  /** Set color RGB para una célula específica (r,g,b en 0-255). */
  setCellColor: (cellKey: CellKey, r: number, g: number, b: number) => void

  /** Set canal IMPACT para una célula (dimmer/strobe/shutter/limit en 0-100%). */
  setCellImpact: (cellKey: CellKey, channel: ImpactChannelName, percent: number) => void

  /** Set canal BEAM para una célula (gobo/prism/focus/zoom/iris en 0-255). */
  setCellBeam: (cellKey: CellKey, channel: BeamChannelName, value0_255: number) => void

  /**
   * Set canal KINETIC para una célula.
   * Unidades por canal:
   *  - pan: 0-540° (se normaliza /540)
   *  - tilt: 0-270° (se normaliza /270)
   *  - speed: 0-100% (se normaliza /100)
   *  - rotation: 0-100% (se normaliza /100)
   *  - targetX/Y/Z: metros directos (sin normalizar)
   */
  setCellKinetic: (cellKey: CellKey, channel: KineticChannelName, value: number) => void

  /** Set phantom/extra channel en una célula (value 0-255). */
  setCellExtra: (cellKey: CellKey, channelKey: string, value0_255: number) => void

  /** Libera el override de UNA célula (por cellKey). */
  releaseCell: (cellKey: CellKey) => void

  /** Libera todas las celdas de un device. */
  releaseDevice: (deviceId: DeviceId) => void

  /** Libera TODAS las celdas. */
  releaseAllCells: () => void

  /** El bridge llama esto tras flushear con éxito el set indicado de cellKeys. */
  consumeDirtyCells: (cellKeys: readonly CellKey[]) => void

  /** El bridge llama esto tras flushear con éxito los nodeIds del clear queue. */
  consumePendingClearNodeIds: (nodeIds: readonly NodeId[]) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createEmptyOverrides(): ProgrammerOverrides {
  return {
    dimmer: null,
    strobe: null,
    shutter: null,
    limit: null,
    red: null,
    green: null,
    blue: null,
    white: null,
    amber: null,
    pan: null,
    tilt: null,
    speed: null,
    targetX: null,
    targetY: null,
    targetZ: null,
    gobo: null,
    prism: null,
    focus: null,
    zoom: null,
    iris: null,
    extras: new Map(),
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function getNorm(channels: Record<string, number> | null | undefined, key: string): number | null {
  const value = channels?.[key]
  return typeof value === 'number' ? clamp01(value) : null
}

function getNormAny(
  channels: Record<string, number> | null | undefined,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = channels?.[key]
    if (typeof value === 'number') return clamp01(value)
  }
  return null
}

const MIXED = Symbol('mixed')

// ─── WAVE 4724: CELL LAYER HELPERS ─────────────────────────────────────────

/**
 * Crea un payload vacío para la familia indicada.
 * Útil para inicializar un cellOverride al primer setter.
 */
function createEmptyCellPayload(family: NodeFamily): CellOverridePayload {
  switch (family) {
    case NodeFamily.COLOR:      return { family, data: {} as ColorCellPayload }
    case NodeFamily.IMPACT:     return { family, data: {} as ImpactCellPayload }
    case NodeFamily.BEAM:       return { family, data: {} as BeamCellPayload }
    case NodeFamily.KINETIC:    return { family, data: {} as KineticCellPayload }
    case NodeFamily.ATMOSPHERE: return { family, data: new Map<string, number>() }
  }
}

/**
 * Mergea inmutablemente un parche en el payload de una célula, preservando
 * los canales no tocados.
 *
 * INVARIANTE: el `family` del parche debe coincidir con el del existing.
 * Si no, se ignora el parche para evitar corrupción de discriminantes.
 */
function mergeCellPayload(
  existing: CellOverridePayload,
  patchFamily: NodeFamily,
  patch: Partial<ColorCellPayload> | Partial<ImpactCellPayload> | Partial<BeamCellPayload> | Partial<KineticCellPayload> | { extra: { key: string; value: number } },
): CellOverridePayload {
  if (existing.family !== patchFamily) {
    // Family mismatch — devolver intacto para no corromper discriminante
    return existing
  }
  switch (existing.family) {
    case NodeFamily.COLOR:
      return { family: NodeFamily.COLOR, data: { ...existing.data, ...(patch as Partial<ColorCellPayload>) } }
    case NodeFamily.IMPACT:
      return { family: NodeFamily.IMPACT, data: { ...existing.data, ...(patch as Partial<ImpactCellPayload>) } }
    case NodeFamily.BEAM:
      return { family: NodeFamily.BEAM, data: { ...existing.data, ...(patch as Partial<BeamCellPayload>) } }
    case NodeFamily.KINETIC:
      return { family: NodeFamily.KINETIC, data: { ...existing.data, ...(patch as Partial<KineticCellPayload>) } }
    case NodeFamily.ATMOSPHERE: {
      const extraPatch = patch as { extra: { key: string; value: number } }
      const next = new Map(existing.data)
      next.set(extraPatch.extra.key, extraPatch.extra.value)
      return { family: NodeFamily.ATMOSPHERE, data: next }
    }
  }
}

function resolveSharedOverrideValue(
  fixtureIds: readonly string[],
  fixtureOverrides: ReadonlyMap<string, ProgrammerOverrides>,
  picker: (override: ProgrammerOverrides | undefined) => number | null,
): number | null | typeof MIXED {
  let hasBaseline = false
  let baseline: number | null = null

  for (const fixtureId of fixtureIds) {
    const current = picker(fixtureOverrides.get(fixtureId))
    if (!hasBaseline) {
      baseline = current
      hasBaseline = true
      continue
    }
    if (baseline !== current) {
      return MIXED
    }
  }

  return baseline
}

function resolveDisplayScalar(
  fixtureIds: readonly string[],
  fixtureOverrides: ReadonlyMap<string, ProgrammerOverrides>,
  picker: (override: ProgrammerOverrides | undefined) => number | null,
  defaultValue: number,
  mapValue: (value: number) => number,
): DisplayScalar {
  const shared = resolveSharedOverrideValue(fixtureIds, fixtureOverrides, picker)
  if (shared === MIXED) return null
  if (shared === null) return defaultValue
  return mapValue(shared)
}

function resolveDisplayColor(
  fixtureIds: readonly string[],
  fixtureOverrides: ReadonlyMap<string, ProgrammerOverrides>,
): DisplayColor {
  return {
    r: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.red ?? null, 255, value => Math.round(value * 255)),
    g: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.green ?? null, 255, value => Math.round(value * 255)),
    b: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.blue ?? null, 255, value => Math.round(value * 255)),
  }
}

function resolveDisplayState(
  fixtureIds: readonly string[],
  fixtureOverrides: ReadonlyMap<string, ProgrammerOverrides>,
): Pick<ProgrammerState, 'displayDimmer' | 'displayStrobe' | 'displayLimit' | 'displayColor'> {
  if (fixtureIds.length === 0) {
    return {
      displayDimmer: 100,
      displayStrobe: 0,
      displayLimit: 100,
      displayColor: { r: 255, g: 255, b: 255 },
    }
  }

  return {
    displayDimmer: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.dimmer ?? null, 100, value => Math.round(value * 100)),
    displayStrobe: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.strobe ?? null, 0, value => Math.round(value * 100)),
    displayLimit: resolveDisplayScalar(fixtureIds, fixtureOverrides, ov => ov?.limit ?? null, 100, value => Math.round(value * 100)),
    displayColor: resolveDisplayColor(fixtureIds, fixtureOverrides),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useProgrammerStore = create<ProgrammerState & ProgrammerActions>()(
  subscribeWithSelector((set, get) => ({
    // ── Estado inicial ──
    fixtureOverrides: new Map(),
    dirtyFamilies: new Set(),
    activeFixtureIds: [],
    displayDimmer: 100,
    displayStrobe: 0,
    displayLimit: 100,
    displayColor: { r: 255, g: 255, b: 255 },

    // ── WAVE 4724: CELL LAYER STATE (inicializadores) ───────────────────
    cellOverrides: new Map<CellKey, CellOverride>(),
    dirtyCells: new Set<CellKey>(),
    pendingClearNodeIds: new Set<NodeId>(),
    cellRegistry: new Map<CellKey, CellDescriptor>(),
    cellsByDevice: new Map<DeviceId, readonly CellKey[]>(),

    // ── SELECTION ──

    syncSelection: (fixtureIds) => {
      set(state => {
        // CLEAN CABIN: purgar del Map los fixtures que ya no están en la selección.
        // Esto elimina overrides zombie que el bridge seguiría enviando a 44Hz
        // para fixtures deseleccionados sin override activo visible.
        const incomingSet = new Set(fixtureIds)
        const next = new Map(state.fixtureOverrides)
        const dirty = new Set(state.dirtyFamilies)
        let hadZombies = false
        for (const id of state.fixtureOverrides.keys()) {
          if (!incomingSet.has(id)) {
            // Solo eliminar si todos los valores son null (sin override real activo).
            // Si el fixture tiene valores activos, conservar para que el bridge
            // envíe el clear explícito al NodeArbiter antes de liberar el Map.
            const ov = state.fixtureOverrides.get(id)!
            const hasActiveOverride =
              ov.dimmer !== null || ov.strobe !== null || ov.shutter !== null ||
              ov.red !== null || ov.green !== null || ov.blue !== null ||
              ov.white !== null || ov.amber !== null ||
              ov.pan !== null || ov.tilt !== null || ov.speed !== null ||
              ov.focus !== null || ov.zoom !== null || ov.gobo !== null ||
              ov.prism !== null || ov.extras.size > 0
            if (!hasActiveOverride) {
              next.delete(id)
              hadZombies = true
            }
          }
        }
        const finalOverrides = hadZombies ? next : state.fixtureOverrides
        return {
          activeFixtureIds: fixtureIds,
          fixtureOverrides: finalOverrides,
          ...resolveDisplayState(fixtureIds, finalOverrides),
        }
      })
    },

    hydrateFromL2: (fixtureIds, overridesByNodeId) => {
      set(state => {
        // Guard de carrera: no hidratar si la selección cambió en paralelo.
        if (state.activeFixtureIds.join(',') !== fixtureIds.join(',')) {
          return {}
        }

        const next = new Map(state.fixtureOverrides)

        for (const fixtureId of fixtureIds) {
          const base = next.get(fixtureId) ?? createEmptyOverrides()

          const impact = overridesByNodeId[`${fixtureId}:impact`]
          const color = overridesByNodeId[`${fixtureId}:color`]
          const kinetic = overridesByNodeId[`${fixtureId}:kinetic`]
          const beam = overridesByNodeId[`${fixtureId}:beam`]
          const extras = overridesByNodeId[`${fixtureId}:atmosphere`]

          next.set(fixtureId, {
            ...base,
            dimmer: getNorm(impact, 'dimmer'),
            strobe: getNorm(impact, 'strobe'),
            shutter: getNorm(impact, 'shutter'),

            red: getNormAny(color, ['red', 'r']),
            green: getNormAny(color, ['green', 'g']),
            blue: getNormAny(color, ['blue', 'b']),
            white: getNorm(color, 'white'),
            amber: getNorm(color, 'amber'),

            pan: getNorm(kinetic, 'pan'),
            tilt: getNorm(kinetic, 'tilt'),
            speed: getNorm(kinetic, 'speed'),
            targetX: getNorm(kinetic, 'targetX'),
            targetY: getNorm(kinetic, 'targetY'),
            targetZ: getNorm(kinetic, 'targetZ'),

            gobo: getNorm(beam, 'gobo') ?? getNorm(extras, 'gobo'),
            prism: getNorm(beam, 'prism') ?? getNorm(extras, 'prism'),
            focus: getNorm(beam, 'focus'),
            zoom: getNorm(beam, 'zoom'),
            iris: getNorm(beam, 'iris'),

            extras: new Map(
              Object.entries(extras ?? {}).map(([k, v]) => [k, clamp01(v)]),
            ),
          })
        }

        return {
          fixtureOverrides: next,
          ...resolveDisplayState(fixtureIds, next),
        }
      })
    },

    // ── IMPACT ──

    setDimmer: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, dimmer: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayDimmer: percent }
      })
    },

    releaseDimmer: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, dimmer: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayDimmer: 100 }
      })
    },

    setStrobe: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, strobe: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayStrobe: percent }
      })
    },

    releaseStrobe: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, strobe: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayStrobe: 0 }
      })
    },

    setLimit: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          // WAVE 4531: Solo persiste el limit en el override.
          // El cap real lo aplica el NodeArbiter post-arbitraje vía setInhibitLimit IPC.
          // El dimmer NO se escala aquí.
          next.set(id, { ...ov, limit: normalized })
        }
        // El limit no pertenece a ninguna dirty family del bridge —
        // se envía por su propio canal IPC desde TheProgrammer.tsx.
        return { fixtureOverrides: next, displayLimit: percent }
      })
    },

    releaseLimit: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, limit: null })
        }
        return { fixtureOverrides: next, displayLimit: 100 }
      })
    },

    // ── COLOR ──

    setColor: (r, g, b) => {
      const nr = clamp01(r / 255)
      const ng = clamp01(g / 255)
      const nb = clamp01(b / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          // Solo toca canales RGB — white/amber se mantienen intactos.
          // El operador debe limpiarlos explícitamente si lo desea.
          next.set(id, {
            ...ov,
            red: nr,
            green: ng,
            blue: nb,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('COLOR')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayColor: { r, g, b } }
      })
    },

    releaseColor: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, red: null, green: null, blue: null, white: null, amber: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('COLOR')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayColor: { r: 255, g: 255, b: 255 } }
      })
    },

    // ── KINETIC ──

    setPosition: (panDeg, tiltDeg) => {
      const normPan = clamp01(panDeg / 540)
      const normTilt = clamp01(tiltDeg / 270)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, {
            ...ov,
            pan: normPan,
            tilt: normTilt,
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setSpatialPosition: (target) => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, {
            ...ov,
            pan: null,
            tilt: null,
            targetX: target.x,
            targetY: target.y,
            targetZ: target.z,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setPositionPerFixture: (positions) => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const { fixtureId, pan, tilt } of positions) {
          const ov = next.get(fixtureId) ?? createEmptyOverrides()
          next.set(fixtureId, {
            ...ov,
            pan: clamp01(pan / 540),
            tilt: clamp01(tilt / 270),
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releasePosition: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, {
            ...ov,
            pan: null,
            tilt: null,
            speed: null,
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setKineticSpeed: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, speed: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseKineticSpeed: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, speed: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── BEAM ──

    setBeam: (channel, value) => {
      const normalized = clamp01(value / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, [channel]: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('BEAM')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseBeam: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, gobo: null, prism: null, focus: null, zoom: null, iris: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('BEAM')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── EXTRAS (phantom channels) ──

    setExtra: (channelKey, value) => {
      const normalized = clamp01(value / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          const extras = new Map(ov.extras)
          extras.set(channelKey, normalized)
          next.set(id, { ...ov, extras })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('EXTRAS')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseExtras: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, extras: new Map() })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('EXTRAS')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── UNLOCK ALL ──

    releaseAll: () => {
      set(state => {
        // CLEAN CABIN: RELEASE ALL vacía el Map completamente.
        // El bridge detectará que fixtureOverrides está vacío y enviará
        // clearManualOverrides para cada nodeId conocido antes de limpiar.
        // Usar un Map vacío (no keys con empty objects) elimina el set de
        // zombies null-value que crecía monótonamente durante el show.
        const next = new Map<string, ProgrammerOverrides>()
        // Conservar solo los fixtures de la selección activa que PUEDEN tener
        // overrides nuevos inmediatamente después — se inicializan vacíos
        // para que el bridge pueda enviar el clear al NodeArbiter.
        for (const id of state.activeFixtureIds) {
          next.set(id, createEmptyOverrides())
        }
        const allFamilies: Set<ProgrammerFamily> = new Set([
          'IMPACT', 'COLOR', 'KINETIC', 'BEAM', 'EXTRAS',
        ])
        return {
          fixtureOverrides: next,
          dirtyFamilies: allFamilies,
          displayDimmer: 100,
          displayStrobe: 0,
          displayLimit: 100,
          displayColor: { r: 255, g: 255, b: 255 },
        }
      })
    },

    // ── BRIDGE CONTROL ──

    consumeDirty: () => {
      set({ dirtyFamilies: new Set() })
    },

    consumeDirtyFamilies: (families) => {
      set(state => {
        const next = new Set(state.dirtyFamilies)
        for (const family of families) {
          next.delete(family)
        }
        return { dirtyFamilies: next }
      })
    },

    // ═════════════════════════════════════════════════════════════════════
    // WAVE 4724: CELL LAYER ACTIONS — IMPLEMENTACIÓN
    // ═════════════════════════════════════════════════════════════════════

    registerFixtureCells: (descriptors) => {
      if (descriptors.length === 0) return
      set(state => {
        // 1. Indexar por deviceId — una sola pasada O(N)
        const groupedByDevice = new Map<DeviceId, CellKey[]>()
        for (const d of descriptors) {
          let arr = groupedByDevice.get(d.deviceId)
          if (!arr) {
            arr = []
            groupedByDevice.set(d.deviceId, arr)
          }
          arr.push(d.cellKey)
        }

        // 2. Catálogo: insertar/actualizar todos los descriptors
        const nextRegistry = new Map(state.cellRegistry)
        for (const d of descriptors) {
          nextRegistry.set(d.cellKey, d)
        }

        // 3. Índice device → cells: fusionar arrays existentes con los nuevos
        const nextCellsByDevice = new Map(state.cellsByDevice)
        for (const [deviceId, freshCellKeys] of groupedByDevice) {
          const existing = nextCellsByDevice.get(deviceId)
          if (!existing) {
            nextCellsByDevice.set(deviceId, Object.freeze(freshCellKeys.slice()) as readonly CellKey[])
          } else {
            // Merge sin duplicados, preservando orden de inserción
            const seen = new Set(existing)
            const merged: CellKey[] = existing.slice()
            for (const k of freshCellKeys) {
              if (!seen.has(k)) {
                merged.push(k)
                seen.add(k)
              }
            }
            nextCellsByDevice.set(deviceId, Object.freeze(merged) as readonly CellKey[])
          }
        }

        return {
          cellRegistry: nextRegistry,
          cellsByDevice: nextCellsByDevice,
        }
      })
    },

    unregisterDeviceCells: (deviceId) => {
      set(state => {
        const cellKeys = state.cellsByDevice.get(deviceId)
        if (!cellKeys || cellKeys.length === 0) {
          // Nada que liberar
          if (state.cellsByDevice.has(deviceId)) {
            const next = new Map(state.cellsByDevice)
            next.delete(deviceId)
            return { cellsByDevice: next }
          }
          return {}
        }

        const nextOverrides = new Map(state.cellOverrides)
        const nextDirty = new Set(state.dirtyCells)
        const nextClears = new Set(state.pendingClearNodeIds)
        const nextRegistry = new Map(state.cellRegistry)

        for (const cellKey of cellKeys) {
          const ov = nextOverrides.get(cellKey)
          if (ov) {
            // Programar clear de los nodeIds reales antes de eliminar el override
            for (const nid of ov.nodeIds) {
              nextClears.add(nid)
            }
            nextOverrides.delete(cellKey)
          } else {
            // Sin override activo: igualmente programar clear de los nodeIds
            // del registry para liberar el L2 si quedó sucio por una sesión previa.
            const desc = nextRegistry.get(cellKey)
            if (desc) {
              for (const nid of desc.nodeIds) nextClears.add(nid)
            }
          }
          nextDirty.delete(cellKey)
          nextRegistry.delete(cellKey)
        }

        const nextCellsByDevice = new Map(state.cellsByDevice)
        nextCellsByDevice.delete(deviceId)

        return {
          cellOverrides: nextOverrides,
          dirtyCells: nextDirty,
          pendingClearNodeIds: nextClears,
          cellRegistry: nextRegistry,
          cellsByDevice: nextCellsByDevice,
        }
      })
    },

    setCellColor: (cellKey, r, g, b) => {
      const patch: Partial<ColorCellPayload> = {
        r: clamp01(r / 255),
        g: clamp01(g / 255),
        b: clamp01(b / 255),
      }
      set(state => upsertCellOverride(state, cellKey, NodeFamily.COLOR, patch))
    },

    setCellImpact: (cellKey, channel, percent) => {
      const patch: Partial<ImpactCellPayload> = { [channel]: clamp01(percent / 100) }
      set(state => upsertCellOverride(state, cellKey, NodeFamily.IMPACT, patch))
    },

    setCellBeam: (cellKey, channel, value0_255) => {
      const patch: Partial<BeamCellPayload> = { [channel]: clamp01(value0_255 / 255) }
      set(state => upsertCellOverride(state, cellKey, NodeFamily.BEAM, patch))
    },

    setCellKinetic: (cellKey, channel, value) => {
      let normalized: number
      switch (channel) {
        case 'pan':      normalized = clamp01(value / 540); break
        case 'tilt':     normalized = clamp01(value / 270); break
        case 'speed':    normalized = clamp01(value / 100); break
        case 'rotation': normalized = clamp01(value / 100); break
        // targetX/Y/Z: metros directos, sin clamp01 porque pueden ser negativos
        case 'targetX':
        case 'targetY':
        case 'targetZ':  normalized = value; break
      }
      const patch: Partial<KineticCellPayload> = { [channel]: normalized }
      set(state => upsertCellOverride(state, cellKey, NodeFamily.KINETIC, patch))
    },

    setCellExtra: (cellKey, channelKey, value0_255) => {
      const normalized = clamp01(value0_255 / 255)
      set(state => upsertCellOverride(state, cellKey, NodeFamily.ATMOSPHERE, {
        extra: { key: channelKey, value: normalized },
      }))
    },

    releaseCell: (cellKey) => {
      set(state => {
        const ov = state.cellOverrides.get(cellKey)
        if (!ov) return {}

        const nextOverrides = new Map(state.cellOverrides)
        nextOverrides.delete(cellKey)

        const nextDirty = new Set(state.dirtyCells)
        nextDirty.delete(cellKey)

        const nextClears = new Set(state.pendingClearNodeIds)
        for (const nid of ov.nodeIds) nextClears.add(nid)

        return {
          cellOverrides: nextOverrides,
          dirtyCells: nextDirty,
          pendingClearNodeIds: nextClears,
        }
      })
    },

    releaseDevice: (deviceId) => {
      set(state => {
        const cellKeys = state.cellsByDevice.get(deviceId)
        if (!cellKeys || cellKeys.length === 0) return {}

        const nextOverrides = new Map(state.cellOverrides)
        const nextDirty = new Set(state.dirtyCells)
        const nextClears = new Set(state.pendingClearNodeIds)

        for (const cellKey of cellKeys) {
          const ov = nextOverrides.get(cellKey)
          if (ov) {
            for (const nid of ov.nodeIds) nextClears.add(nid)
            nextOverrides.delete(cellKey)
          }
          nextDirty.delete(cellKey)
        }

        return {
          cellOverrides: nextOverrides,
          dirtyCells: nextDirty,
          pendingClearNodeIds: nextClears,
        }
      })
    },

    releaseAllCells: () => {
      set(state => {
        if (state.cellOverrides.size === 0) return {}

        const nextClears = new Set(state.pendingClearNodeIds)
        for (const ov of state.cellOverrides.values()) {
          for (const nid of ov.nodeIds) nextClears.add(nid)
        }

        return {
          cellOverrides: new Map<CellKey, CellOverride>(),
          dirtyCells: new Set<CellKey>(),
          pendingClearNodeIds: nextClears,
        }
      })
    },

    consumeDirtyCells: (cellKeys) => {
      if (cellKeys.length === 0) return
      set(state => {
        const next = new Set(state.dirtyCells)
        for (const k of cellKeys) next.delete(k)
        return { dirtyCells: next }
      })
    },

    consumePendingClearNodeIds: (nodeIds) => {
      if (nodeIds.length === 0) return
      set(state => {
        const next = new Set(state.pendingClearNodeIds)
        for (const nid of nodeIds) next.delete(nid)
        return { pendingClearNodeIds: next }
      })
    },
  }))
)

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 4724: PURE STATE TRANSFORMER — upsertCellOverride
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert puro de un cellOverride: si existe, mergea el parche en su payload;
 * si no existe pero el device está registrado, error silencioso (la UI debe
 * llamar `registerFixtureCells` antes de cualquier setter).
 *
 * Valida que `family` coincida con el override existente — un cell jamás
 * cambia de familia (la familia depende del nodo Aether, no del setter).
 *
 * Retorna un partial para pasar a `set()` de Zustand. Solo crea las nuevas
 * estructuras inmutables cuando hay cambio real.
 */
function upsertCellOverride(
  state: ProgrammerState,
  cellKey: CellKey,
  family: NodeFamily,
  patch: Partial<ColorCellPayload> | Partial<ImpactCellPayload> | Partial<BeamCellPayload> | Partial<KineticCellPayload> | { extra: { key: string; value: number } },
): Partial<ProgrammerState> {
  const existing = state.cellOverrides.get(cellKey)

  let nextOverride: CellOverride
  if (!existing) {
    // Primera escritura: resolvemos nodeIds + deviceId desde el registry.
    // Si no está registrada, descartamos el override (anti-simulación).
    const descriptor = state.cellRegistry.get(cellKey)
    if (!descriptor) {
      console.warn(`[programmerStore] setCell* ignorado: cellKey "${cellKey}" no registrada. Llama registerFixtureCells primero.`)
      return {}
    }
    if (descriptor.family !== family) {
      console.warn(`[programmerStore] setCell* family mismatch en "${cellKey}": registry=${descriptor.family} patch=${family}`)
      return {}
    }
    const newPayload = mergeCellPayload(createEmptyCellPayload(family), family, patch)
    nextOverride = {
      cellKey,
      nodeIds: descriptor.nodeIds,   // referencia directa al array congelado del registry
      deviceId: descriptor.deviceId,
      payload: newPayload,
      lastWriteMs: Date.now(),
    }
  } else {
    if (existing.payload.family !== family) {
      // Family mismatch — proteger discriminante. NO se permite cambio de familia.
      console.warn(`[programmerStore] setCell* family mismatch en "${cellKey}": existing=${existing.payload.family} patch=${family}`)
      return {}
    }
    const newPayload = mergeCellPayload(existing.payload, family, patch)
    if (newPayload === existing.payload) return {}  // no-op
    nextOverride = {
      ...existing,
      payload: newPayload,
      lastWriteMs: Date.now(),
    }
  }

  const nextOverrides = new Map(state.cellOverrides)
  nextOverrides.set(cellKey, nextOverride)
  const nextDirty = new Set(state.dirtyCells)
  nextDirty.add(cellKey)

  return {
    cellOverrides: nextOverrides,
    dirtyCells: nextDirty,
  }
}
