/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FORGE HYBRID BUILDER STATE — WAVE 4732-A
 *
 * IForgeBuilderState: única fuente de verdad mientras la Forja está abierta.
 * Reducer puro + action types exhaustivos.
 *
 * DISEÑO: Dos mundos, un estado.
 *   - `channels`: el mundo físico DMX (1 entry por canal, indexed por dmxOffset).
 *   - `cells`:    el mundo lógico Aether (ICapabilityNode builders, N canales c/u).
 *
 * Las warnings emitidas por el reducer fluyen a través de [drainForgeWarnings()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/forge/forgeBuilderState.ts:107:0-112:1)
 * (side-channel intencional — el reducer permanece puro respecto al state React).
 *
 * @module core/forge/forgeBuilderState
 * @version WAVE 4732-A
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  ChannelType,
  FixtureChannel,
  FixtureType,
  IgnitionDependency,
  FixtureDefinition,
  WheelColor,
  ColorEngineType,
  ColorWheelDefinition,
  IDMXGovernor,
  IForgePhysics,
  IForgeWheels,
  IAetherCellSnapshot,
} from '../../types/FixtureDefinition'
import { NodeFamily } from '../aether/types'
import type { NodeRole } from '../aether/types'
import { canAdmit } from './cellTypeAdmittance'

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgeFixtureMeta {
  readonly manufacturer: string
  readonly name:         string
  readonly type:         FixtureType
  readonly mode?:        string
  readonly channelCount: number
}

/**
 * Representación de una célula Aether en construcción.
 * Corresponde 1:1 a un ICapabilityNode en runtime.
 */
export interface IForgeCellBuilder {
  /** ID estable. Autogenerado. **No renombrable** (preserva cellOverrides runtime). */
  readonly cellId:         string
  /** Familia Aether — determina aduana de tipos y setter del Programmer. */
  readonly family:         NodeFamily
  /** Etiqueta humana — alimenta `CellDescriptor.label`. Editable por el operador. */
  readonly label:          string
  /** Rol semántico — alimenta `CellDescriptor.role` (afecta neon UI). */
  readonly role:           NodeRole
  /** Índices DMX 0-based de los canales que componen la célula. Orden = orden visual. */
  readonly channelIndices: readonly number[]
  /** Override de zona Aether opcional. */
  readonly aetherZone?:    string
  /** Posición en el lienzo — solo UX, no se compila al JSON. */
  readonly uiPosition?:    { readonly x: number; readonly y: number }
}


/**
 * Estado completo de la Forja mientras está abierta.
 * Dos pestañas, UN solo state. Reducer único.
 * WAVE FORGE CONVERGENCE: fuente ÚNICA de verdad para channels, cells,
 * governors, physics y wheels.
 */
export interface IForgeBuilderState {
  readonly meta:           IForgeFixtureMeta
  /** Driver de Tab DMX Layout: array de canales ordenado por index (0-based). */
  readonly channels:       readonly FixtureChannel[]
  /** Driver de Tab Aether Modules: array de células lógicas. */
  readonly cells:          readonly IForgeCellBuilder[]
  /** Reglas de última milla — DMX Governor Engine. */
  readonly dmxGovernors:   readonly IDMXGovernor[]
  readonly capabilities:   Readonly<Record<string, unknown>>
  /** Física del motor — absorbida desde el useState de la UI. */
  readonly physics:        IForgePhysics | null
  /** Rueda de color — absorbida desde el useState de la UI. */
  readonly wheels:         IForgeWheels | null
  /** true si el state difiere del último Save (muestra "•" en el título). */
  readonly dirty:          boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// WARNING SIDE-CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export interface ForgeWarning {
  readonly cellId?:     string
  readonly channelIdx?: number
  readonly reason:      string
}

// Mutable por diseño — side-channel fuera del state React.
let _pendingWarnings: ForgeWarning[] = []

/** Consume y devuelve las warnings generadas por el reducer desde el último drain. */
export function drainForgeWarnings(): readonly ForgeWarning[] {
  const w = _pendingWarnings
  _pendingWarnings = []
  return w
}

function emitWarning(w: ForgeWarning): void {
  _pendingWarnings.push(w)
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Tab DMX Layout
export type DmxAction =
  | { type: 'CHANNEL_REPLACE';        idx: number; channel: FixtureChannel }
  | { type: 'CHANNEL_SET_TYPE';       idx: number; channelType: ChannelType }
  | { type: 'CHANNEL_SET_NAME';       idx: number; name: string }
  | { type: 'CHANNEL_SET_DEFAULT';    idx: number; value: number }
  | { type: 'CHANNEL_SET_16BIT';      idx: number; is16bit: boolean }
  | { type: 'CHANNEL_CLEAR';          idx: number }
  | { type: 'CHANNEL_DELETE';         idx: number }
  | { type: 'IGNITION_ADD';           idx: number; dep: IgnitionDependency }
  | { type: 'IGNITION_UPDATE';        idx: number; depIdx: number; patch: Partial<IgnitionDependency> }
  | { type: 'IGNITION_REMOVE';        idx: number; depIdx: number }

// Tab Aether Modules
export type CellAction =
  | { type: 'CELL_CREATE';            family: NodeFamily; cellId?: string }
  | { type: 'CELL_RENAME_LABEL';      cellId: string; label: string }
  | { type: 'CELL_SET_ROLE';          cellId: string; role: NodeRole }
  | { type: 'CELL_SET_ZONE';          cellId: string; zone?: string }
  | { type: 'CELL_DELETE';            cellId: string }
  | { type: 'CELL_ATTACH_CHANNEL';    cellId: string; channelIdx: number }
  | { type: 'CELL_DETACH_CHANNEL';    cellId: string; channelIdx: number }
  | { type: 'CELL_MOVE_CHANNEL';      fromCellId: string; toCellId: string; channelIdx: number }

// Metadata
export type MetaAction =
  | { type: 'META_SET_MANUFACTURER';  manufacturer: string }
  | { type: 'META_SET_NAME';          name: string }
  | { type: 'META_SET_TYPE';          fixtureType: FixtureType }
  | { type: 'META_SET_MODE';          mode: string | undefined }
  | { type: 'META_SET_CHANNEL_COUNT'; channelCount: number }

// Lifecycle
export type LifecycleAction =
  | { type: 'HYDRATE_FROM_FIXTURE'; fixture: FixtureDefinition }
  | { type: 'MARK_CLEAN' }
  | { type: 'RESET' }

// Governor rules — DMX last-mile engine
export type GovernorAction =
  | { type: 'GOVERNOR_SET_ALL'; governors: readonly IDMXGovernor[] }
  | { type: 'GOVERNOR_ADD';     governor: IDMXGovernor }
  | { type: 'GOVERNOR_UPDATE';  channelIndex: number; governor: IDMXGovernor }
  | { type: 'GOVERNOR_REMOVE';  channelIndex: number }
  | { type: 'GOVERNOR_SET_FOR_CHANNEL'; channelIndex: number; governor: IDMXGovernor | null }

// Capabilities (patch explícito — sin spread ciego desde compileForgeState)
export type CapabilityAction =
  | { type: 'CAPABILITY_SET';   key: string; value: unknown }
  | { type: 'CAPABILITY_MERGE'; patch: Record<string, unknown> }

// Physics
export type PhysicsAction =
  | { type: 'PHYSICS_SET'; physics: IForgePhysics | null }

// Wheels
export type WheelsAction =
  | { type: 'WHEELS_SET';            wheels: IForgeWheels | null }
  | { type: 'WHEELS_SET_COLORS';     colors: readonly WheelColor[] }
  | { type: 'WHEELS_SET_ENGINE';     engine: ColorEngineType }
  | { type: 'WHEELS_SET_MIN_CHANGE'; ms: number }

// Sincronización bidireccional (reemplaza el useEffect de WAVE 4742)
export type SyncAction =
  | {
      /**
       * Validación post-edición de canal: re-chequea admittance de todas las
       * células que contienen `channelIdx`. Si el nuevo tipo no es admisible,
       * desvincula + emite warning.
       */
      type: 'SYNC_RACK_TO_CELLS'
      channelIdx: number
    }
  | {
      /**
       * Garantía de coherencia de índices: si una célula declara channelIndices
       * fuera del rango actual de channels[], amplía channels[] con placeholders
       * sin sobrescribir entradas existentes ni sus propiedades físicas.
       */
      type: 'SYNC_CELLS_TO_RACK'
      cellId: string
    }

export type ForgeAction =
  | DmxAction
  | CellAction
  | MetaAction
  | GovernorAction
  | CapabilityAction
  | PhysicsAction
  | WheelsAction
  | SyncAction
  | LifecycleAction

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE & ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export function makeInitialForgeState(): IForgeBuilderState {
  return {
    meta: {
      manufacturer: '',
      name:         '',
      type:         'generic',
      channelCount: 8,
    },
    channels:     [],
    cells:        [],
    dmxGovernors: [],
    capabilities: {},
    physics:      null,
    wheels:       null,
    dirty:        false,
  }
}

let _cellSerial = 0

function nextCellId(family: NodeFamily): string {
  return `${String(family).toLowerCase()}-${++_cellSerial}`
}

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════

export function forgeReducer(
  state: IForgeBuilderState,
  action: ForgeAction,
): IForgeBuilderState {
  switch (action.type) {

    // ── META ────────────────────────────────────────────────────────────
    case 'META_SET_MANUFACTURER':
      return { ...state, meta: { ...state.meta, manufacturer: action.manufacturer }, dirty: true }

    case 'META_SET_NAME':
      return { ...state, meta: { ...state.meta, name: action.name }, dirty: true }

    case 'META_SET_TYPE':
      return { ...state, meta: { ...state.meta, type: action.fixtureType }, dirty: true }

    case 'META_SET_MODE':
      return { ...state, meta: { ...state.meta, mode: action.mode }, dirty: true }

    case 'META_SET_CHANNEL_COUNT': {
      const count = Math.max(1, action.channelCount)
      return {
        ...state,
        meta:     { ...state.meta, channelCount: count },
        channels: resizeChannels(state.channels, count),
        dirty:    true,
      }
    }

    // ── CHANNEL (DMX Layout) ─────────────────────────────────────────────
    case 'CHANNEL_REPLACE':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, action.channel),
        dirty:    true,
      }

    case 'CHANNEL_SET_TYPE':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { type: action.channelType }),
        dirty:    true,
      }

    case 'CHANNEL_SET_NAME':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { name: action.name }),
        dirty:    true,
      }

    case 'CHANNEL_SET_DEFAULT':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { defaultValue: action.value }),
        dirty:    true,
      }

    case 'CHANNEL_SET_16BIT':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { is16bit: action.is16bit }),
        dirty:    true,
      }

    case 'CHANNEL_CLEAR':
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, {
          type: 'unknown', name: '', defaultValue: 0, is16bit: false, ignitionDeps: [],
        }),
        dmxGovernors: state.dmxGovernors.filter(g => g.channelIndex !== action.idx),
        dirty: true,
      }

    case 'CHANNEL_DELETE': {
      const idx = action.idx
      if (idx < 0 || idx >= state.channels.length) return state
      return {
        ...state,
        channels:     state.channels.filter((_, i) => i !== idx),
        cells:        state.cells.map(c => ({
          ...c,
          channelIndices: c.channelIndices
            .filter(i => i !== idx)
            .map(i => (i > idx ? i - 1 : i)),
        })),
        dmxGovernors: state.dmxGovernors
          .filter(g => g.channelIndex !== idx)
          .map(g => g.channelIndex > idx
            ? { ...g, channelIndex: g.channelIndex - 1 }
            : g),
        meta:         { ...state.meta, channelCount: Math.max(1, state.channels.length - 1) },
        dirty:        true,
      }
    }

    case 'IGNITION_ADD': {
      const ch = state.channels[action.idx]
      if (!ch) return state
      const deps = [...(ch.ignitionDeps ?? []), action.dep]
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { ignitionDeps: deps }),
        dirty:    true,
      }
    }

    case 'IGNITION_UPDATE': {
      const ch = state.channels[action.idx]
      if (!ch || !ch.ignitionDeps) return state
      const deps = ch.ignitionDeps.map((d, i) =>
        i === action.depIdx ? { ...d, ...action.patch } : d,
      )
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { ignitionDeps: deps }),
        dirty:    true,
      }
    }

    case 'IGNITION_REMOVE': {
      const ch = state.channels[action.idx]
      if (!ch || !ch.ignitionDeps) return state
      const deps = ch.ignitionDeps.filter((_, i) => i !== action.depIdx)
      // WAVE 4872: Simetría con handler V1 — eliminar la clave cuando queda vacía.
      // Dejar ignitionDeps:[] en forgeState causaba asimetría respecto al Channel Rack
      // (que omite la clave) y contaminaba la igualdad estructural sameDeps en sync.
      const patchedCh: FixtureChannel = deps.length === 0
        ? (({ ignitionDeps: _omit, ...rest }) => rest)(ch) as FixtureChannel
        : { ...ch, ignitionDeps: deps }
      return {
        ...state,
        channels: state.channels.map((c, i) => i === action.idx ? patchedCh : c),
        dirty:    true,
      }
    }

    // ── CELL (Aether Modules) ────────────────────────────────────────────
    case 'CELL_CREATE': {
      const cellId = action.cellId ?? nextCellId(action.family)
      const newCell: IForgeCellBuilder = {
        cellId,
        family:         action.family,
        label:          defaultLabelFor(action.family),
        role:           'primary',
        channelIndices: [],
        uiPosition:     { x: 0, y: state.cells.length * 140 },
      }
      return { ...state, cells: [...state.cells, newCell], dirty: true }
    }

    case 'CELL_RENAME_LABEL':
      return {
        ...state,
        cells: state.cells.map(c =>
          c.cellId === action.cellId ? { ...c, label: action.label } : c,
        ),
        dirty: true,
      }

    case 'CELL_SET_ROLE':
      return {
        ...state,
        cells: state.cells.map(c =>
          c.cellId === action.cellId ? { ...c, role: action.role } : c,
        ),
        dirty: true,
      }

    case 'CELL_SET_ZONE':
      return {
        ...state,
        cells: state.cells.map(c =>
          c.cellId === action.cellId ? { ...c, aetherZone: action.zone } : c,
        ),
        dirty: true,
      }

    case 'CELL_DELETE':
      return {
        ...state,
        cells: state.cells.filter(c => c.cellId !== action.cellId),
        dirty: true,
      }

    case 'CELL_ATTACH_CHANNEL': {
      const { cellId, channelIdx } = action
      const targetCell = state.cells.find(c => c.cellId === cellId)
      if (!targetCell) return state
      const channel = state.channels[channelIdx]
      if (!channel) return state

      // Aduana de tipos — AUTORIDAD FINAL (triple validation §6.3)
      const admission = canAdmit(channel.type, targetCell.family)
      if (admission.ok === false) {
        emitWarning({ cellId, channelIdx, reason: admission.reason })
        return state  // no-op
      }

      // Invariant (§3): channelIdx pertenece como máximo a UNA célula.
      // Se detach de cualquier célula previa antes de añadir.
      const cells = state.cells.map(c => {
        if (c.cellId === cellId) {
          if (c.channelIndices.includes(channelIdx)) return c  // ya está
          return { ...c, channelIndices: [...c.channelIndices, channelIdx] }
        }
        if (c.channelIndices.includes(channelIdx)) {
          return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
        }
        return c
      })
      const expanded = expandChannelsToMaxIndex(state, [...cells.flatMap(c => c.channelIndices), channelIdx])
      return { ...expanded, cells, dirty: true }
    }

    case 'CELL_DETACH_CHANNEL': {
      const { cellId, channelIdx } = action
      return {
        ...state,
        cells: state.cells.map(c =>
          c.cellId === cellId
            ? { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
            : c,
        ),
        dirty: true,
      }
    }

    case 'CELL_MOVE_CHANNEL': {
      const { fromCellId, toCellId, channelIdx } = action
      const destCell = state.cells.find(c => c.cellId === toCellId)
      if (!destCell) return state
      const channel = state.channels[channelIdx]
      if (!channel) return state

      // Aduana al destino
      const admission = canAdmit(channel.type, destCell.family)
      if (admission.ok === false) {
        emitWarning({ cellId: toCellId, channelIdx, reason: admission.reason })
        return state
      }

      const cells = state.cells.map(c => {
        if (c.cellId === fromCellId) {
          return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
        }
        if (c.cellId === toCellId) {
          if (c.channelIndices.includes(channelIdx)) return c
          return { ...c, channelIndices: [...c.channelIndices, channelIdx] }
        }
        return c
      })
      const expanded = expandChannelsToMaxIndex(state, cells.flatMap(c => c.channelIndices))
      return { ...expanded, cells, dirty: true }
    }

    // ── GOVERNOR (DMX last-mile rules) ───────────────────────────────────
    case 'GOVERNOR_SET_ALL':
      return { ...state, dmxGovernors: action.governors, dirty: true }

    case 'GOVERNOR_ADD':
      return {
        ...state,
        dmxGovernors: [...state.dmxGovernors, action.governor],
        dirty:        true,
      }

    case 'GOVERNOR_UPDATE': {
      const govIdx = state.dmxGovernors.findIndex(g => g.channelIndex === action.channelIndex)
      if (govIdx === -1) return state
      return {
        ...state,
        dmxGovernors: state.dmxGovernors.map((g, i) => i === govIdx ? action.governor : g),
        dirty:        true,
      }
    }

    case 'GOVERNOR_REMOVE':
      return {
        ...state,
        dmxGovernors: state.dmxGovernors.filter(g => g.channelIndex !== action.channelIndex),
        dirty:        true,
      }

    case 'GOVERNOR_SET_FOR_CHANNEL': {
      const { channelIndex, governor } = action
      if (governor === null) {
        return {
          ...state,
          dmxGovernors: state.dmxGovernors.filter(g => g.channelIndex !== channelIndex),
          dirty:        true,
        }
      }
      const idx = state.dmxGovernors.findIndex(g => g.channelIndex === channelIndex)
      const next = idx === -1
        ? [...state.dmxGovernors, governor]
        : state.dmxGovernors.map((g, i) => (i === idx ? governor : g))
      return { ...state, dmxGovernors: next, dirty: true }
    }

    // ── CAPABILITY ─────────────────────────────────────────────────────────────
    case 'CAPABILITY_SET':
      return {
        ...state,
        capabilities: { ...state.capabilities, [action.key]: action.value },
        dirty:        true,
      }

    case 'CAPABILITY_MERGE':
      return {
        ...state,
        capabilities: { ...state.capabilities, ...action.patch },
        dirty:        true,
      }

    // ── PHYSICS ───────────────────────────────────────────────────────────────
    case 'PHYSICS_SET':
      return { ...state, physics: action.physics, dirty: true }

    // ── WHEELS ───────────────────────────────────────────────────────────────
    case 'WHEELS_SET':
      return { ...state, wheels: action.wheels, dirty: true }

    case 'WHEELS_SET_COLORS': {
      const wBase = state.wheels ?? { colors: [] as WheelColor[], colorEngine: 'rgb' as ColorEngineType, minChangeTimeMs: 500 }
      return { ...state, wheels: { ...wBase, colors: [...action.colors] }, dirty: true }
    }

    case 'WHEELS_SET_ENGINE': {
      const wBase = state.wheels ?? { colors: [] as WheelColor[], colorEngine: 'rgb' as ColorEngineType, minChangeTimeMs: 500 }
      return { ...state, wheels: { ...wBase, colorEngine: action.engine }, dirty: true }
    }

    case 'WHEELS_SET_MIN_CHANGE': {
      const wBase = state.wheels ?? { colors: [] as WheelColor[], colorEngine: 'rgb' as ColorEngineType, minChangeTimeMs: 500 }
      return { ...state, wheels: { ...wBase, minChangeTimeMs: action.ms }, dirty: true }
    }

    // ── SYNC — bidireccional (reemplaza useEffect WAVE 4742) ──────────────────
    case 'SYNC_RACK_TO_CELLS': {
      const { channelIdx } = action
      const ch = state.channels[channelIdx]
      if (!ch) return state
      let nextCells = state.cells
      let changed   = false
      for (const cell of state.cells) {
        if (!cell.channelIndices.includes(channelIdx)) continue
        const admission = canAdmit(ch.type, cell.family)
        if (admission.ok === false) {
          emitWarning({
            cellId:     cell.cellId,
            channelIdx,
            reason:     `Type change invalidated attachment: ${admission.reason}`,
          })
          nextCells = nextCells.map(c =>
            c.cellId === cell.cellId
              ? { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
              : c,
          )
          changed = true
        }
      }
      return changed ? { ...state, cells: nextCells, dirty: true } : state
    }

    case 'SYNC_CELLS_TO_RACK': {
      const allIndices = state.cells.flatMap(c => [...c.channelIndices])
      if (allIndices.length === 0) return state
      return expandChannelsToMaxIndex({ ...state, dirty: true }, allIndices)
    }

    // ── LIFECYCLE ────────────────────────────────────────────────────────
    case 'HYDRATE_FROM_FIXTURE': {
      const { fixture } = action
      return {
        meta: {
          manufacturer: fixture.manufacturer ?? '',
          name:         fixture.name ?? '',
          type:         fixture.type ?? 'generic',
          mode:         (fixture as unknown as Record<string, unknown>).mode as string | undefined,
          channelCount: fixture.channels.length,
        },
        channels:     hydrateChannels(fixture),
        cells:        hydrateAetherCells(fixture),
        dmxGovernors: fixture.dmxGovernors ?? [],
        capabilities: (fixture.capabilities as unknown as Record<string, unknown>) ?? {},
        physics:      hydratePhysics(fixture),
        wheels:       hydrateWheels(fixture),
        dirty:        false,
      }
    }

    case 'MARK_CLEAN':
      return { ...state, dirty: false }

    case 'RESET':
      return makeInitialForgeState()

    default:
      return state
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PURE HELPERS — reducer internals
// ═══════════════════════════════════════════════════════════════════════════

function patchChannel(
  channels: readonly FixtureChannel[],
  idx: number,
  patch: Partial<FixtureChannel>,
): readonly FixtureChannel[] {
  if (idx < 0 || idx >= channels.length) return channels
  return channels.map((ch, i) => (i === idx ? { ...ch, ...patch } : ch))
}

function resizeChannels(
  channels: readonly FixtureChannel[],
  count: number,
): readonly FixtureChannel[] {
  const result: FixtureChannel[] = []
  for (let i = 0; i < count; i++) {
    result.push(
      channels[i] ?? { index: i, name: '', type: 'unknown', defaultValue: 0, is16bit: false },
    )
  }
  return result
}

function expandChannelsToMaxIndex(
  state: IForgeBuilderState,
  indices: readonly number[],
): IForgeBuilderState {
  if (indices.length === 0) return state
  const maxIdx = Math.max(...indices)
  if (maxIdx < state.channels.length) return state
  const next: FixtureChannel[] = [...state.channels]
  for (let i = next.length; i <= maxIdx; i++) {
    next.push({
      index:        i,
      name:         `Auto-allocated ${i}`,
      type:         'custom',
      defaultValue: 0,
      is16bit:      false,
    })
  }
  return {
    ...state,
    channels: next,
    meta:     { ...state.meta, channelCount: next.length },
  }
}

function defaultLabelFor(family: NodeFamily): string {
  const labels: Record<string, string> = {
    COLOR:      'Color',
    IMPACT:     'Intensidad',
    KINETIC:    'Posición',
    BEAM:       'Haz',
    ATMOSPHERE: 'Atmósfera',
  }
  return labels[String(family)] ?? String(family)
}

// ── Hydration from FixtureDefinition ──────────────────────────────────────

function hydrateChannels(fixture: FixtureDefinition): readonly FixtureChannel[] {
  const count = fixture.channels.length
  const result: FixtureChannel[] = []
  for (let i = 0; i < count; i++) {
    result.push(
      fixture.channels[i] ?? { index: i, name: '', type: 'unknown', defaultValue: 0, is16bit: false },
    )
  }
  return result
}

type NodeGraphLike = {
  nodes: Array<{ type: string; config: Record<string, unknown> }>
}

function hydrateCells(fixture: FixtureDefinition): readonly IForgeCellBuilder[] {
  // Ruta A: reconstruct from nodeGraph output_dmx nodes grouped by aetherNodeId.
  // Si no hay nodeGraph, la Tab Aether abre vacía (ruta B legacy, §8.1).
  const graph = (fixture as unknown as Record<string, unknown>).nodeGraph as NodeGraphLike | undefined
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return []

  const buckets = new Map<string, { indices: number[]; zone?: string; label?: string }>()

  for (const node of graph.nodes) {
    if (node.type !== 'output_dmx') continue
    const cfg = node.config
    if (!cfg || typeof cfg.aetherNodeId !== 'string') continue
    const id = cfg.aetherNodeId
    if (!buckets.has(id)) {
      buckets.set(id, {
        indices: [],
        zone: cfg.aetherZone as string | undefined,
        label: typeof cfg.cellLabel === 'string' ? cfg.cellLabel : undefined,
      })
    }
    const dmxOffset = cfg.dmxOffset
    if (typeof dmxOffset === 'number') {
      buckets.get(id)!.indices.push(dmxOffset)
    }
  }

  if (buckets.size === 0) return []

  return Array.from(buckets.entries()).map(([cellId, bucket], i) => ({
    cellId,
    family:         inferFamilyFromCellId(cellId),
    label:          bucket.label || formatCellLabel(cellId),
    role:           inferRoleFromCellId(cellId) as NodeRole,
    channelIndices: [...bucket.indices].sort((a, b) => a - b),
    aetherZone:     bucket.zone,
    uiPosition:     { x: 0, y: i * 140 },
  }))
}

function inferFamilyFromCellId(cellId: string): NodeFamily {
  const id = cellId.toLowerCase()
  if (id.includes('color') || id.includes('petal') || id.includes('wash') || id.includes('pixel')) {
    return NodeFamily.COLOR
  }
  if (id.includes('impact') || id.includes('golden') || id.includes('stain')) {
    return NodeFamily.IMPACT
  }
  if (id.includes('kinetic') || id.includes('pan') || id.includes('tilt') || id.includes('position')) {
    return NodeFamily.KINETIC
  }
  if (id.includes('beam') || id.includes('gobo') || id.includes('focus') || id.includes('zoom')) {
    return NodeFamily.BEAM
  }
  return NodeFamily.ATMOSPHERE
}

function inferRoleFromCellId(cellId: string): string {
  const id = cellId.toLowerCase()
  if (id.includes('petal') || id.includes('pixel')) return 'pixel'
  if (id.includes('wash'))                           return 'ambient'
  if (id.includes('beam'))                           return 'decoration'
  return 'primary'
}

function formatCellLabel(cellId: string): string {
  return cellId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function inferRoleFromFamily(family: string): NodeRole {
  const f = family.toLowerCase()
  if (f.includes('pixel')) return 'pixel'
  if (f.includes('wash') || f.includes('ambient')) return 'ambient'
  if (f.includes('beam') || f.includes('gobo')) return 'decoration'
  return 'primary'
}

// ── hydrateAetherCells — Route A (aetherCells JSON) → Route B (legacy nodeGraph) ─

/**
 * WAVE FORGE CONVERGENCE:
 * Ruta A — lee el snapshot `aetherCells` guardado en el JSON.
 *           Restaura layout visual exacto (uiPosition preservada).
 * Ruta B — fallback legacy: reconstruye células desde nodeGraph.output_dmx.
 *           Solo activo para fixtures guardados ANTES de esta WAVE.
 */
function hydrateAetherCells(fixture: FixtureDefinition): readonly IForgeCellBuilder[] {
  const raw   = fixture as unknown as Record<string, unknown>
  const saved = raw.aetherCells as IAetherCellSnapshot[] | undefined

  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map((snap, i) => ({
      cellId:         snap.id,
      family:         parseNodeFamily(snap.family),
      label:          snap.label,
      role:           inferRoleFromFamily(snap.family),
      channelIndices: [...snap.channelIndices],
      aetherZone:     snap.zone,
      uiPosition:     snap.layout ?? { x: 0, y: i * 140 },
    }))
  }

  return hydrateCells(fixture)
}

function parseNodeFamily(raw: string): NodeFamily {
  const up = raw.toUpperCase() as keyof typeof NodeFamily
  if (up in NodeFamily) return NodeFamily[up]
  return NodeFamily.ATMOSPHERE
}

// ── hydratePhysics — desde fixture.physics ────────────────────────────────

function hydratePhysics(fixture: FixtureDefinition): IForgePhysics | null {
  const p = fixture.physics
  if (!p) return null
  return {
    motorType:       (p.motorType        ?? 'stepper') as IForgePhysics['motorType'],
    maxAcceleration: p.maxAcceleration  ?? 2000,
    maxVelocity:     p.maxVelocity      ?? 500,
    safetyCap:       Boolean(p.safetyCap ?? true),
    orientation:     p.orientation     ?? 'floor',
    invertPan:       p.invertPan        ?? false,
    invertTilt:      p.invertTilt       ?? false,
    swapPanTilt:     p.swapPanTilt      ?? false,
    homePosition:    p.homePosition     ?? { pan: 127, tilt: 127 },
    tiltLimits:      p.tiltLimits       ?? { min: 0, max: 270 },
  }
}

// ── hydrateWheels — desde fixture.wheels + capabilities ───────────────────

function hydrateWheels(fixture: FixtureDefinition): IForgeWheels | null {
  const raw = fixture as unknown as Record<string, unknown>
  const legacyCaps = (raw.capabilities ?? {}) as Record<string, unknown>
  const legacyColorWheel = legacyCaps.colorWheel as ColorWheelDefinition | undefined

  const colors = fixture.wheels?.colors ?? legacyColorWheel?.colors ?? []
  if (colors.length === 0) return null

  return {
    colors:          [...colors],
    colorEngine:     fixture.wheels?.colorEngine ?? (legacyCaps.colorEngine as ColorEngineType) ?? 'rgb',
    minChangeTimeMs: fixture.wheels?.minChangeTimeMs ?? legacyColorWheel?.minChangeTimeMs ?? 500,
  }
}