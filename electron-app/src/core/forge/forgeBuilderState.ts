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
 * Las warnings emitidas por el reducer fluyen a través de `drainForgeWarnings()`
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
 */
export interface IForgeBuilderState {
  readonly meta:         IForgeFixtureMeta
  /** Driver de Tab DMX Layout: array de canales ordenado por index (0-based). */
  readonly channels:     readonly FixtureChannel[]
  /** Driver de Tab Aether Modules: array de células lógicas. */
  readonly cells:        readonly IForgeCellBuilder[]
  readonly capabilities: Readonly<Record<string, unknown>>
  /** true si el state difiere del último Save (muestra "•" en el título). */
  readonly dirty:        boolean
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
  | { type: 'CHANNEL_SET_TYPE';       idx: number; channelType: ChannelType }
  | { type: 'CHANNEL_SET_NAME';       idx: number; name: string }
  | { type: 'CHANNEL_SET_DEFAULT';    idx: number; value: number }
  | { type: 'CHANNEL_SET_16BIT';      idx: number; is16bit: boolean }
  | { type: 'CHANNEL_CLEAR';          idx: number }
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

export type ForgeAction = DmxAction | CellAction | MetaAction | LifecycleAction

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
    capabilities: {},
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
        dirty: true,
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
      return {
        ...state,
        channels: patchChannel(state.channels, action.idx, { ignitionDeps: deps }),
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
      return { ...state, cells, dirty: true }
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
      return { ...state, cells, dirty: true }
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
        cells:        hydrateCells(fixture),
        capabilities: (fixture.capabilities as unknown as Record<string, unknown>) ?? {},
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

  const buckets = new Map<string, { indices: number[]; zone?: string }>()

  for (const node of graph.nodes) {
    if (node.type !== 'output_dmx') continue
    const cfg = node.config
    if (!cfg || typeof cfg.aetherNodeId !== 'string') continue
    const id = cfg.aetherNodeId
    if (!buckets.has(id)) buckets.set(id, { indices: [], zone: cfg.aetherZone as string | undefined })
    buckets.get(id)!.indices.push(cfg.dmxOffset as number)
  }

  if (buckets.size === 0) return []

  return Array.from(buckets.entries()).map(([cellId, bucket], i) => ({
    cellId,
    family:         inferFamilyFromCellId(cellId),
    label:          formatCellLabel(cellId),
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
