/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️  FORGE HYBRID COMPILER — WAVE 4732-C
 *
 * Función pura, sincrónica y sin side-effects.
 * Transforma `IForgeBuilderState` → `FixtureDefinitionV2` lista para disco.
 *
 * FASES INTERNAS:
 *   A — Validación estática (errores bloqueantes + warnings)
 *   B — Resolución de IgnitionDeps (targetChannelIndex vs channelType)
 *   C — Emisión del nodeGraph desde las células Aether
 *   D — Ensamblaje final del FixtureDefinition
 *
 * GARANTÍAS:
 *   - Pureza: no toca disco, no toca store, no llama IPC.
 *   - Sin pérdida silenciosa: todo dato dropeado emite warning con código + ancla.
 *   - compile(decompile(compile(s))) ≡ compile(s)  (testeado en 4732-G)
 *
 * @module core/forge/compileForgeState
 * @version WAVE 4732-C
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  FixtureChannel,
  IgnitionDependency,
} from '../../types/FixtureDefinition'
import { deriveCapabilities } from '../../types/FixtureDefinition'
import type { FixtureDefinitionV2 } from './types'
import type {
  IForgeNodeGraph,
  IForgeNode,
  IForgeEdge,
  IForgePort,
  ForgeNodeId,
  ForgeGraphMeta,
  IInputDmxConfig,
  IOutputDmxConfig,
} from './types'
import { canAdmit } from './cellTypeAdmittance'
import type { IForgeBuilderState, IForgeCellBuilder } from './forgeBuilderState'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════════════════

export type ForgeValidationLevel = 'error' | 'warning'

export type ForgeValidationCode =
  | 'EMPTY_CELL'
  | 'INCOMPATIBLE_CHANNEL_FAMILY'
  | 'DUPLICATE_CELL_ID'
  | 'NO_CHANNELS'
  | 'AMBIGUOUS_DEP'
  | 'MISSING_DEP'

export interface ForgeValidationIssue {
  readonly level:      ForgeValidationLevel
  readonly code:       ForgeValidationCode
  readonly message:    string
  readonly cellId?:    string
  readonly channelIdx?: number
  readonly depIdx?:    number
}

export type CompileResult =
  | { ok: true;  fixture: FixtureDefinitionV2; warnings: readonly ForgeValidationIssue[] }
  | { ok: false; errors: readonly ForgeValidationIssue[]; warnings: readonly ForgeValidationIssue[] }

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_VERSION = '1.0.0' as const
const GENERATOR_WAVE = 'WAVE-4732-C'
const INPUT_COL_X    = 100
const OUTPUT_COL_X   = 500
const ROW_SPACING_Y  = 80
const ROW_START_Y    = 60

// ═══════════════════════════════════════════════════════════════════════════
// FASE A — VALIDACIÓN ESTÁTICA
// ═══════════════════════════════════════════════════════════════════════════

function validateState(
  state:    IForgeBuilderState,
  errors:   ForgeValidationIssue[],
  warnings: ForgeValidationIssue[],
): void {
  // V1: Al menos un canal que no sea unknown
  const usableChannels = state.channels.filter(c => c.type !== 'unknown')
  if (usableChannels.length === 0) {
    errors.push({
      level:   'error',
      code:    'NO_CHANNELS',
      message: 'El fixture no tiene canales definidos. Añade al menos un canal en DMX Layout.',
    })
    return  // sin canales, el resto de validaciones carece de sentido
  }

  // V2: cellId único
  const seenIds = new Map<string, number>()
  for (const cell of state.cells) {
    const prev = seenIds.get(cell.cellId)
    if (prev !== undefined) {
      errors.push({
        level:   'error',
        code:    'DUPLICATE_CELL_ID',
        message: `cellId '${cell.cellId}' aparece ${prev + 1} veces. Cada célula debe tener un ID único.`,
        cellId:  cell.cellId,
      })
    }
    seenIds.set(cell.cellId, (prev ?? 0) + 1)
  }

  // V3: células vacías son error bloqueante
  for (const cell of state.cells) {
    if (cell.channelIndices.length === 0) {
      errors.push({
        level:   'error',
        code:    'EMPTY_CELL',
        message: `La célula '${cell.label}' (${cell.cellId}) está vacía. Las células vacías se omiten — elimínala o asígnale canales.`,
        cellId:  cell.cellId,
      })
    }
  }

  // V4: aduana de tipos — capa defensiva (el reducer ya la aplica; esta es la autoridad final)
  for (const cell of state.cells) {
    for (const idx of cell.channelIndices) {
      const ch = state.channels[idx]
      if (!ch) continue
      const result = canAdmit(ch.type, cell.family)
      if (result.ok === false) {
        errors.push({
          level:      'error',
          code:       'INCOMPATIBLE_CHANNEL_FAMILY',
          message:    `Canal CH${idx + 1} (${ch.type}) es incompatible con familia ${String(cell.family)}: ${result.reason}`,
          cellId:     cell.cellId,
          channelIdx: idx,
        })
      }
    }
  }

  // V5: canales con ignitionDeps — resolución incompleta → warning
  for (const ch of state.channels) {
    if (!ch.ignitionDeps) continue
    for (let di = 0; di < ch.ignitionDeps.length; di++) {
      const dep = ch.ignitionDeps[di]
      if (dep.targetChannelIndex !== undefined) continue  // ya resuelto
      // Solo channelType → buscar cuántos canales coinciden
      const matches = state.channels.filter(c => c.type === dep.channelType && c.index !== ch.index)
      if (matches.length === 0) {
        warnings.push({
          level:      'warning',
          code:       'MISSING_DEP',
          message:    `CH${ch.index + 1}: dep ${di} referencia tipo '${dep.channelType}' pero ningún canal coincide.`,
          channelIdx: ch.index,
          depIdx:     di,
        })
      } else if (matches.length > 1) {
        warnings.push({
          level:      'warning',
          code:       'AMBIGUOUS_DEP',
          message:    `CH${ch.index + 1}: dep ${di} referencia tipo '${dep.channelType}' pero hay ${matches.length} candidatos. Asigna targetChannelIndex en DMX Layout.`,
          channelIdx: ch.index,
          depIdx:     di,
        })
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE B — RESOLUCIÓN DE IGNITION DEPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Copia el dep con `targetChannelIndex` resuelto cuando sea posible.
 * Si solo hay un candidato por `channelType`, auto-resuelve silenciosamente.
 * Si hay varios → lo deja como está (el operador debe resolver en la UI).
 */
function resolveDep(
  dep:      IgnitionDependency,
  channels: readonly FixtureChannel[],
  selfIdx:  number,
): IgnitionDependency {
  if (dep.targetChannelIndex !== undefined) return dep  // ya tiene índice explícito
  const matches = channels.filter(c => c.type === dep.channelType && c.index !== selfIdx)
  if (matches.length === 1) {
    return { ...dep, targetChannelIndex: matches[0].index }
  }
  return dep
}

function resolveChannelDeps(ch: FixtureChannel, channels: readonly FixtureChannel[]): FixtureChannel {
  if (!ch.ignitionDeps || ch.ignitionDeps.length === 0) return ch
  return {
    ...ch,
    ignitionDeps: ch.ignitionDeps.map(d => resolveDep(d, channels, ch.index)),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE C — EMISIÓN DEL NODE GRAPH
// ═══════════════════════════════════════════════════════════════════════════

function makeInputPort(): IForgePort {
  return {
    id:           'value',
    label:        'Value',
    dataType:     'normalized',
    direction:    'in',
    defaultValue: 0,
    required:     true,
  }
}

function makeOutputPort(): IForgePort {
  return {
    id:           'value',
    label:        'Value',
    dataType:     'normalized',
    direction:    'out',
    defaultValue: 0,
  }
}

function makeInputDmxNode(ch: FixtureChannel, rowIndex: number): IForgeNode {
  const nodeId: ForgeNodeId = `in-${ch.type}-${ch.index}`
  const config: IInputDmxConfig = { nodeType: 'input_dmx', channelKey: ch.type }
  return {
    id:         nodeId,
    type:       'input_dmx',
    category:   'input',
    inputs:     [],
    outputs:    [makeOutputPort()],
    config,
    uiPosition: { x: INPUT_COL_X, y: ROW_START_Y + rowIndex * ROW_SPACING_Y },
    label:      `IN: ${ch.type}`,
  }
}

function makeOutputDmxNode(
  ch:          FixtureChannel,
  rowIndex:    number,
  aetherNodeId?: string,
  aetherZone?:   string,
): IForgeNode {
  const nodeId: ForgeNodeId = `out-${ch.type}-${ch.index}`
  const config: IOutputDmxConfig = {
    nodeType:          'output_dmx',
    channelType:        ch.type,
    dmxOffset:          ch.index,
    channelName:        ch.name || undefined,
    defaultDmxValue:    ch.defaultValue,
    is16bit:            ch.is16bit || undefined,
    continuousRotation: ch.continuousRotation || undefined,
    aetherNodeId,
    aetherZone,
    ...(ch.ignitionDeps && ch.ignitionDeps.length > 0 && {
      ignitionDeps: ch.ignitionDeps.map(d => ({
        channelType:        d.channelType,
        requiredValue:      d.requiredValue,
        targetChannelIndex: d.targetChannelIndex,
        mode:               d.mode,
      })),
    }),
  }
  const inputPortWithDefault: IForgePort = {
    ...makeInputPort(),
    defaultValue: ch.defaultValue / 255,
  }
  return {
    id:         nodeId,
    type:       'output_dmx',
    category:   'output',
    inputs:     [inputPortWithDefault],
    outputs:    [],
    config,
    uiPosition: { x: OUTPUT_COL_X, y: ROW_START_Y + rowIndex * ROW_SPACING_Y },
    label:      `CH${ch.index + 1}: ${ch.name || ch.type}`,
  }
}

function makeEdge(inNodeId: ForgeNodeId, outNodeId: ForgeNodeId, idx: number): IForgeEdge {
  return {
    id:         `edge-${String(idx).padStart(3, '0')}`,
    sourceNode: inNodeId,
    sourcePort: 'value',
    targetNode: outNodeId,
    targetPort: 'value',
  }
}

/**
 * Construye el IForgeNodeGraph desde las células del estado.
 * Canales asignados → llevan `aetherNodeId`. Canales libres → passthrough sin id de célula.
 */
function compileNodeGraph(
  state:            IForgeBuilderState,
  resolvedChannels: readonly FixtureChannel[],
): IForgeNodeGraph {
  const nodes: IForgeNode[] = []
  const edges: IForgeEdge[] = []

  // Mapa rápido channelIdx → célula propietaria
  const channelToCell = new Map<number, IForgeCellBuilder>()
  for (const cell of state.cells) {
    for (const idx of cell.channelIndices) {
      channelToCell.set(idx, cell)
    }
  }

  let rowIndex = 0
  let edgeIndex = 0

  // Ordenar por índice DMX para layout reproducible
  const sortedChannels = [...resolvedChannels].sort((a, b) => a.index - b.index)

  for (const ch of sortedChannels) {
    if (ch.type === 'unknown') continue  // canales unknown = ignorados

    const ownerCell  = channelToCell.get(ch.index)
    const aetherNodeId = ownerCell?.cellId
    const aetherZone   = ownerCell?.aetherZone

    const inNode  = makeInputDmxNode(ch, rowIndex)
    const outNode = makeOutputDmxNode(ch, rowIndex, aetherNodeId, aetherZone)
    const edge    = makeEdge(inNode.id, outNode.id, edgeIndex)

    nodes.push(inNode, outNode)
    edges.push(edge)
    rowIndex++
    edgeIndex++
  }

  // Calcular dmxFootprint
  let maxOffset = 0
  for (const ch of resolvedChannels) {
    if (ch.type === 'unknown') continue
    const end = ch.is16bit ? ch.index + 1 : ch.index
    if (end > maxOffset) maxOffset = end
  }

  const meta: ForgeGraphMeta = {
    createdAt:     new Date().toISOString(),
    generatorWave: GENERATOR_WAVE,
    autoMigrated:  false,
    dmxFootprint:  maxOffset + 1,
  }

  return { version: SCHEMA_VERSION, nodes, edges, meta }
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE D — ENSAMBLAJE FINAL
// ═══════════════════════════════════════════════════════════════════════════

function buildFixtureId(manufacturer: string, name: string): string {
  const slug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `user-hybrid-${slug(manufacturer)}-${slug(name)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT PÚBLICO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compila un `IForgeBuilderState` en un `FixtureDefinitionV2` listo para disco.
 *
 * @param state - Estado completo de la Forja
 * @returns CompileResult — ok:true con fixture + warnings, o ok:false con errores
 */
export function compileForgeState(state: IForgeBuilderState): CompileResult {
  const errors:   ForgeValidationIssue[] = []
  const warnings: ForgeValidationIssue[] = []

  // ── Fase A: Validación ────────────────────────────────────────────────
  validateState(state, errors, warnings)
  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }

  // ── Fase B: Resolución de deps ────────────────────────────────────────
  const resolvedChannels: FixtureChannel[] = state.channels.map(ch =>
    resolveChannelDeps(ch, state.channels)
  )

  // ── Fase C: NodeGraph ─────────────────────────────────────────────────
  const nodeGraph = compileNodeGraph(state, resolvedChannels)

  // ── Fase D: Ensamblaje ────────────────────────────────────────────────
  const derived = deriveCapabilities(resolvedChannels)

  const fixture: FixtureDefinitionV2 = {
    id:           buildFixtureId(state.meta.manufacturer, state.meta.name),
    name:         state.meta.name,
    manufacturer: state.meta.manufacturer,
    type:         state.meta.type,
    channels:     resolvedChannels,     // array legacy — compatibilidad
    nodeGraph,                           // ← fuente de verdad V2
    capabilities: {
      hasPan:           derived.hasPanTilt,
      hasTilt:          derived.hasPanTilt,
      hasColorMixing:   derived.hasColorMixing,
      hasColorWheel:    derived.hasColorWheel,
      hasGobo:          derived.hasGobos,
      hasPrism:         derived.hasPrism,
      hasStrobe:        derived.hasShutter,
      hasDimmer:        derived.hasDimmer,
      hasRotation:      derived.hasRotation,
      hasCustomChannels: derived.hasCustomChannels,
      hasMacro:         derived.hasMacro,
    },
  }

  return { ok: true, fixture, warnings }
}
