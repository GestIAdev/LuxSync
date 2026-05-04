/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE GRAPH — BIDIRECTIONAL MIGRATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.2: El traductor universal entre pasado (arrays) y futuro (grafos).
 *
 * NodeGraphBuilder convierte bidireccionalmente entre el formato legacy
 * FixtureChannel[] y el nuevo IForgeNodeGraph.
 *
 * DIRECCIÓN 1: fromChannels(channels[]) → IForgeNodeGraph
 *   Genera un grafo "passthrough" equivalente: por cada canal legacy,
 *   crea un input_dmx node → output_dmx node con un edge directo.
 *   El resultado es funcionalmente idéntico al pipeline legacy.
 *
 * DIRECCIÓN 2: toChannels(graph) → FixtureChannel[]
 *   Extrae los output_dmx nodes del grafo y reconstruye el array
 *   legacy ordenado por dmxOffset. Preserva type, name, defaultValue.
 *
 * VALIDACIÓN: validate(graph) → ForgeValidationError[]
 *   Verifica reglas estructurales del grafo (V1–V8 del blueprint).
 *
 * @module core/forge/NodeGraphBuilder
 * @version WAVE 4548.2
 */

import type { FixtureChannel, ChannelType } from '../../types/FixtureDefinition'
import type {
  IForgeNodeGraph,
  IForgeNode,
  IForgeEdge,
  IForgePort,
  ForgeNodeId,
  ForgeEdgeId,
  ForgeGraphMeta,
  ForgeValidationError,
  ForgeValidationErrorCode,
  IInputDmxConfig,
  IOutputDmxConfig,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_VERSION = '1.0.0' as const
const GENERATOR_WAVE = 'WAVE-4548.2'

/** Standard port IDs used for input_dmx → output_dmx passthrough edges */
const PORT_VALUE_OUT = 'value'
const PORT_VALUE_IN  = 'value'

/** UI layout constants for auto-generated nodes */
const INPUT_COLUMN_X  = 100
const OUTPUT_COLUMN_X = 500
const ROW_SPACING_Y   = 80
const ROW_START_Y     = 60

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL KEY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps ChannelType (legacy) to the channelKey used in the Aether IntentBus.
 *
 * Most channel types map 1:1 (the ChannelType string IS the channelKey).
 * The Aether ColorAdapter emits abstract 'r'/'g'/'b', but the NodeResolver
 * also reads 'red'/'green'/'blue'. We use the legacy name directly for
 * maximum compatibility — the NodeResolver handles both namespaces.
 */
function channelTypeToIntentKey(type: ChannelType): string {
  // Direct mapping: the ChannelType string is the channelKey.
  // 'unknown' channels have no meaningful key — we use 'unknown' as placeholder.
  return type
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function makeInputDmxNode(
  channelType: ChannelType,
  channelIndex: number,
  yPosition: number,
): IForgeNode {
  const nodeId: ForgeNodeId = `in-${channelType}-${channelIndex}`
  const config: IInputDmxConfig = {
    nodeType: 'input_dmx',
    channelKey: channelTypeToIntentKey(channelType),
  }
  const outputPort: IForgePort = {
    id: PORT_VALUE_OUT,
    label: 'Value',
    dataType: 'normalized',
    direction: 'out',
    defaultValue: 0,
  }
  return {
    id: nodeId,
    type: 'input_dmx',
    category: 'input',
    inputs: [],
    outputs: [outputPort],
    config,
    uiPosition: { x: INPUT_COLUMN_X, y: yPosition },
    label: `IN: ${channelType}`,
  }
}

function makeOutputDmxNode(
  channel: FixtureChannel,
  yPosition: number,
): IForgeNode {
  const nodeId: ForgeNodeId = `out-${channel.type}-${channel.index}`
  const config: IOutputDmxConfig = {
    nodeType: 'output_dmx',
    channelType: channel.type,
    dmxOffset: channel.index,
    channelName: channel.name || undefined,
    defaultDmxValue: channel.defaultValue,
    is16bit: channel.is16bit || undefined,
    continuousRotation: channel.continuousRotation || undefined,
  }
  const inputPort: IForgePort = {
    id: PORT_VALUE_IN,
    label: 'Value',
    dataType: 'normalized',
    direction: 'in',
    defaultValue: channel.defaultValue / 255,
    required: true,
  }
  return {
    id: nodeId,
    type: 'output_dmx',
    category: 'output',
    inputs: [inputPort],
    outputs: [],
    config,
    uiPosition: { x: OUTPUT_COLUMN_X, y: yPosition },
    label: `CH${channel.index + 1}: ${channel.name || channel.type}`,
  }
}

function makeEdge(
  sourceNodeId: ForgeNodeId,
  targetNodeId: ForgeNodeId,
  edgeIndex: number,
): IForgeEdge {
  const edgeId: ForgeEdgeId = `edge-${edgeIndex.toString().padStart(3, '0')}`
  return {
    id: edgeId,
    sourceNode: sourceNodeId,
    sourcePort: PORT_VALUE_OUT,
    targetNode: targetNodeId,
    targetPort: PORT_VALUE_IN,
  }
}

function makeEmptyMeta(autoMigrated: boolean, dmxFootprint: number): ForgeGraphMeta {
  return {
    createdAt: new Date().toISOString(),
    generatorWave: GENERATOR_WAVE,
    autoMigrated,
    dmxFootprint,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE GRAPH BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export class NodeGraphBuilder {
  // ─── DIRECTION 1: Legacy → Graph ─────────────────────────────────────

  /**
   * Genera un IForgeNodeGraph equivalente desde un array de FixtureChannel[].
   *
   * Para cada canal legacy:
   *   - Crea un `input_dmx` node que lee del IntentBus el canal correspondiente.
   *   - Crea un `output_dmx` node que escribe en el offset DMX del canal.
   *   - Conecta input.value → output.value con un edge directo.
   *
   * El grafo resultante es funcionalmente idéntico al pipeline legacy:
   * la señal pasa directamente del IntentBus al buffer DMX sin transformación.
   *
   * @param channels — Array legacy de FixtureChannel
   * @param meta — Metadata parcial opcional para el grafo generado
   * @returns IForgeNodeGraph equivalente
   */
  static fromChannels(
    channels: readonly FixtureChannel[],
    meta?: Partial<ForgeGraphMeta>,
  ): IForgeNodeGraph {
    if (channels.length === 0) {
      return {
        version: SCHEMA_VERSION,
        nodes: [],
        edges: [],
        meta: {
          ...makeEmptyMeta(true, 0),
          ...meta,
        },
      }
    }

    const nodes: IForgeNode[] = []
    const edges: IForgeEdge[] = []

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i]
      const yPos = ROW_START_Y + i * ROW_SPACING_Y

      const inputNode  = makeInputDmxNode(channel.type, channel.index, yPos)
      const outputNode = makeOutputDmxNode(channel, yPos)
      const edge       = makeEdge(inputNode.id, outputNode.id, i)

      nodes.push(inputNode, outputNode)
      edges.push(edge)
    }

    // Calculate DMX footprint: max(dmxOffset) + 1 (accounting for 16-bit)
    let maxOffset = 0
    for (const channel of channels) {
      const end = channel.is16bit ? channel.index + 1 : channel.index
      if (end > maxOffset) maxOffset = end
    }
    const dmxFootprint = maxOffset + 1

    return {
      version: SCHEMA_VERSION,
      nodes,
      edges,
      meta: {
        ...makeEmptyMeta(true, dmxFootprint),
        ...meta,
      },
    }
  }

  // ─── DIRECTION 2: Graph → Legacy ─────────────────────────────────────

  /**
   * Regenera FixtureChannel[] desde un IForgeNodeGraph.
   * Recorre los output_dmx nodes y produce FixtureChannel[] equivalente.
   * El array se ordena por dmxOffset ascendente.
   *
   * @param graph — El grafo de nodos
   * @returns Array de FixtureChannel compatible con FixtureDefinition legacy
   */
  static toChannels(graph: IForgeNodeGraph): FixtureChannel[] {
    const outputNodes = graph.nodes.filter(
      (n): n is IForgeNode & { config: IOutputDmxConfig } =>
        n.type === 'output_dmx' && n.config.nodeType === 'output_dmx',
    )

    const channels: FixtureChannel[] = outputNodes.map((node) => {
      const cfg = node.config
      const channel: FixtureChannel = {
        index: cfg.dmxOffset,
        name: cfg.channelName || cfg.channelType,
        type: cfg.channelType,
        defaultValue: cfg.defaultDmxValue,
        is16bit: cfg.is16bit ?? false,
      }
      // Preserve INGENIOS metadata if present
      if (cfg.continuousRotation) {
        channel.continuousRotation = true
      }
      if (cfg.channelName && (cfg.channelType === 'custom' || cfg.channelType === 'macro')) {
        channel.customName = cfg.channelName
      }
      return channel
    })

    // Sort by DMX offset (ascending)
    channels.sort((a, b) => a.index - b.index)

    return channels
  }

  // ─── VALIDATION ──────────────────────────────────────────────────────

  /**
   * Validates an IForgeNodeGraph against structural rules.
   *
   * Rules implemented:
   * - V1: Edge sourcePort must exist on sourceNode as output
   * - V2: Edge targetPort must exist on targetNode as input
   * - V3: An input port accepts max 1 incoming edge
   * - V6: Graph must have at least 1 output_dmx node
   * - V7: No two output_dmx nodes may share the same dmxOffset
   *
   * @returns Array of errors (empty = valid)
   */
  static validate(graph: IForgeNodeGraph): ForgeValidationError[] {
    const errors: ForgeValidationError[] = []

    // Build node lookup
    const nodeMap = new Map<string, IForgeNode>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    // ── V6: At least 1 output_dmx node ──────────────────────────────
    const outputNodes = graph.nodes.filter(n => n.type === 'output_dmx')
    if (outputNodes.length === 0 && graph.nodes.length > 0) {
      errors.push({
        code: 'NO_OUTPUT_NODES',
        message: 'Graph has nodes but no output_dmx nodes. At least one DMX output is required.',
      })
    }

    // ── V7: No dmxOffset collisions among output_dmx nodes ──────────
    const offsetsSeen = new Map<number, ForgeNodeId>()
    for (const node of outputNodes) {
      const cfg = node.config as IOutputDmxConfig
      const offset = cfg.dmxOffset
      const existing = offsetsSeen.get(offset)
      if (existing) {
        // Allow 16-bit pair: coarse at offset N and fine at offset N+1
        // are different offsets, so they won't collide here.
        errors.push({
          code: 'DMX_OFFSET_COLLISION',
          message: `DMX offset ${offset} is claimed by both '${existing}' and '${node.id}'.`,
          nodeId: node.id,
        })
      } else {
        offsetsSeen.set(offset, node.id)
      }
    }

    // ── V1 & V2: Edge source/target port validation ─────────────────
    // ── V3: Max 1 incoming edge per input port ──────────────────────
    const incomingCount = new Map<string, { count: number; edgeId: string }>()

    for (const edge of graph.edges) {
      // V1: Source node and port
      const sourceNode = nodeMap.get(edge.sourceNode)
      if (!sourceNode) {
        errors.push({
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge '${edge.id}': source node '${edge.sourceNode}' does not exist.`,
          edgeId: edge.id,
        })
      } else {
        const sourcePort = sourceNode.outputs.find(p => p.id === edge.sourcePort)
        if (!sourcePort) {
          errors.push({
            code: 'INVALID_EDGE_SOURCE',
            message: `Edge '${edge.id}': source port '${edge.sourcePort}' not found on node '${edge.sourceNode}'.`,
            edgeId: edge.id,
            nodeId: edge.sourceNode,
          })
        }
      }

      // V2: Target node and port
      const targetNode = nodeMap.get(edge.targetNode)
      if (!targetNode) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge '${edge.id}': target node '${edge.targetNode}' does not exist.`,
          edgeId: edge.id,
        })
      } else {
        const targetPort = targetNode.inputs.find(p => p.id === edge.targetPort)
        if (!targetPort) {
          errors.push({
            code: 'INVALID_EDGE_TARGET',
            message: `Edge '${edge.id}': target port '${edge.targetPort}' not found on node '${edge.targetNode}'.`,
            edgeId: edge.id,
            nodeId: edge.targetNode,
          })
        }
      }

      // V3: Max 1 incoming edge per input port
      const portKey = `${edge.targetNode}::${edge.targetPort}`
      const existing = incomingCount.get(portKey)
      if (existing) {
        existing.count++
        if (existing.count === 2) {
          errors.push({
            code: 'PORT_ALREADY_CONNECTED',
            message: `Input port '${edge.targetPort}' on node '${edge.targetNode}' has multiple incoming edges. Use a proc_merge node instead.`,
            edgeId: edge.id,
            nodeId: edge.targetNode,
          })
        }
      } else {
        incomingCount.set(portKey, { count: 1, edgeId: edge.id })
      }
    }

    // ── ORPHAN CHECK: Nodes with no edges ───────────────────────────
    const connectedNodes = new Set<string>()
    for (const edge of graph.edges) {
      connectedNodes.add(edge.sourceNode)
      connectedNodes.add(edge.targetNode)
    }
    for (const node of graph.nodes) {
      // Input nodes without outgoing edges and output nodes without incoming edges are orphans.
      // We only warn — not error — for this.
      if (!connectedNodes.has(node.id) && graph.nodes.length > 1) {
        errors.push({
          code: 'ORPHAN_NODE',
          message: `Node '${node.id}' (${node.type}) has no connections.`,
          nodeId: node.id,
        })
      }
    }

    return errors
  }
}
