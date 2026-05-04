/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE GRAPH COMPILER — Patch-Time Compilation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4a): Compila un IForgeNodeGraph en una estructura plana
 * (CompiledForgeGraph) optimizada para evaluación zero-alloc a 44Hz.
 *
 * PIPELINE:
 *   1. Topological Sort (Kahn's Algorithm) → executionOrder[]
 *   2. Wire Allocation → Float64Array (port → index mapping)
 *   3. State Allocation → Float64Array (stateful nodes get offsets)
 *   4. Program Build → CompiledInstruction[] (opcode + offsets)
 *   5. Edge Wiring → Uint32Array of [src, dst] pairs
 *   6. Input/Output Map extraction
 *
 * NOTA: compound_ingenio inlining is deferred to a future iteration.
 * This v1 assumes a flat graph with no compound nodes.
 *
 * @module core/forge/compiler/ForgeGraphCompiler
 * @version WAVE 4548.6
 */

import type { IForgeNodeGraph, IForgeNode, ForgeNodeId, ForgeNodeType } from '../types'
import type {
  IInputDmxConfig,
  IInputAudioBandConfig,
  IInputConstantConfig,
  IProcLfoConfig,
  IProcSmoothConfig,
  IProcMapRangeConfig,
  IProcMathConfig,
  IProcClampConfig,
  IProcDelayConfig,
  IProcMergeConfig,
  IProcCurveConfig,
  ILogicThresholdConfig,
  ILogicCounterConfig,
  ILogicSwitchConfig,
  IOutputDmxConfig,
} from '../types'
import type { CompiledForgeGraph, CompiledInstruction, CompiledOutput } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// OPCODE MAPPING — ForgeNodeType → numeric opcode
// Must stay in sync with OPCODE_TABLE in evaluator/opcodes.ts
// ═══════════════════════════════════════════════════════════════════════════

const OPCODE_MAP: Record<ForgeNodeType, number> = {
  input_dmx:         1,
  input_audio_band:  2,
  input_beat:        3,
  input_bpm:         4,
  input_energy:      5,
  input_constant:    6,
  input_time:        7,
  proc_lfo:          8,
  proc_smooth:       9,
  proc_map_range:   10,
  proc_math:        11,
  proc_clamp:       12,
  proc_delay:       13,
  proc_merge:       14,
  proc_invert:      15,
  proc_curve:       16,
  logic_threshold:  17,
  logic_gate:       18,
  logic_switch:     19,
  logic_and:        20,
  logic_or:         21,
  logic_counter:    22,
  output_dmx:       23,
  compound_ingenio:  0,  // noop — not supported in v1
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM ENUM — for LFO params encoding
// ═══════════════════════════════════════════════════════════════════════════

const WAVEFORM_MAP: Record<string, number> = {
  sine: 0,
  triangle: 1,
  sawtooth: 2,
  square: 3,
  random_hold: 4,
}

// ═══════════════════════════════════════════════════════════════════════════
// MATH OP ENUM
// ═══════════════════════════════════════════════════════════════════════════

const MATH_OP_MAP: Record<string, number> = {
  add: 0,
  subtract: 1,
  multiply: 2,
  divide: 3,
  modulo: 4,
  power: 5,
}

// ═══════════════════════════════════════════════════════════════════════════
// CURVE TYPE ENUM
// ═══════════════════════════════════════════════════════════════════════════

const CURVE_TYPE_MAP: Record<string, number> = {
  linear: 0,
  exponential: 1,
  logarithmic: 2,
  scurve: 3,
  gamma: 4,
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGY ENUM
// ═══════════════════════════════════════════════════════════════════════════

const MERGE_STRATEGY_MAP: Record<string, number> = {
  max: 0,
  min: 1,
  average: 2,
  sum: 3,
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE SLOTS — How many Float64 state slots each node type needs
// ═══════════════════════════════════════════════════════════════════════════

function getStateSlots(node: IForgeNode): number {
  switch (node.type) {
    case 'proc_lfo':       return 1  // phase accumulator
    case 'proc_smooth':    return 1  // previous value
    case 'proc_delay': {
      const cfg = node.config as IProcDelayConfig
      return cfg.delayFrames + 1     // ring buffer + write head
    }
    case 'logic_counter':    return 1  // count
    case 'logic_threshold':  return 1  // lastOutput (hysteresis)
    default:                 return 0  // stateless
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMS EXTRACTION — Config → Float64Array(8) for hot-path
// ═══════════════════════════════════════════════════════════════════════════

function extractParams(node: IForgeNode): Float64Array {
  const p = new Float64Array(8)
  const cfg = node.config

  switch (cfg.nodeType) {
    case 'input_constant': {
      const c = cfg as IInputConstantConfig
      p[0] = c.value
      break
    }
    case 'proc_lfo': {
      const c = cfg as IProcLfoConfig
      p[0] = WAVEFORM_MAP[c.waveform] ?? 0
      p[1] = c.frequencyHz
      p[2] = c.syncToBpm ? 1.0 : 0.0
      p[3] = c.bpmDivisor
      p[4] = c.phase
      break
    }
    case 'proc_smooth': {
      const c = cfg as IProcSmoothConfig
      p[0] = c.attackMs
      p[1] = c.releaseMs
      break
    }
    case 'proc_map_range': {
      const c = cfg as IProcMapRangeConfig
      p[0] = c.inputMin
      p[1] = c.inputMax
      p[2] = c.outputMin
      p[3] = c.outputMax
      break
    }
    case 'proc_math': {
      const c = cfg as IProcMathConfig
      p[0] = MATH_OP_MAP[c.operation] ?? 0
      break
    }
    case 'proc_clamp': {
      const c = cfg as IProcClampConfig
      p[0] = c.min
      p[1] = c.max
      break
    }
    case 'proc_delay': {
      const c = cfg as IProcDelayConfig
      p[0] = c.delayFrames
      break
    }
    case 'proc_merge': {
      const c = cfg as IProcMergeConfig
      p[0] = MERGE_STRATEGY_MAP[c.strategy] ?? 0
      break
    }
    case 'proc_curve': {
      const c = cfg as IProcCurveConfig
      p[0] = CURVE_TYPE_MAP[c.curveType] ?? 0
      p[1] = c.exponent ?? 2.0
      p[2] = c.gamma ?? 2.2
      break
    }
    case 'logic_threshold': {
      const c = cfg as ILogicThresholdConfig
      p[0] = c.threshold
      p[1] = c.hysteresis
      break
    }
    case 'logic_counter': {
      const c = cfg as ILogicCounterConfig
      p[0] = c.modulo
      p[1] = c.emitNormalized ? 1.0 : 0.0
      break
    }
    case 'logic_switch': {
      const c = cfg as ILogicSwitchConfig
      p[0] = c.switchThreshold
      break
    }
    case 'output_dmx': {
      const c = cfg as IOutputDmxConfig
      p[0] = c.defaultDmxValue / 255  // normalized default
      break
    }
    // input_dmx, input_audio_band, input_beat, input_bpm, input_energy,
    // input_time, proc_invert, logic_gate, logic_and, logic_or:
    // No params needed (or already injected externally)
    default:
      break
  }

  return p
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO BAND INDEX — string → Float64Array index
// ═══════════════════════════════════════════════════════════════════════════

export const AUDIO_BAND_INDEX: Record<string, number> = {
  subBass:  0,
  bass:     1,
  mid:      2,
  highMid:  3,
  presence: 4,
  air:      5,
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE GRAPH COMPILER
// ═══════════════════════════════════════════════════════════════════════════

export class ForgeGraphCompiler {

  /**
   * Compila un IForgeNodeGraph en una estructura plana zero-alloc.
   *
   * PATCH TIME — llamar UNA VEZ al registrar un device.
   * El resultado se reutiliza en cada frame sin allocations.
   *
   * @param graph — Grafo de nodos del fixture (design-time)
   * @param fixtureId — ID del fixture propietario
   * @returns CompiledForgeGraph listo para ForgeNodeEvaluator.evaluate()
   */
  static compile(graph: IForgeNodeGraph, fixtureId: string): CompiledForgeGraph {
    // ── 1. Build node index for O(1) lookups ──────────────────────────
    const nodeMap = new Map<ForgeNodeId, IForgeNode>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    // ── 2. Topological Sort (Kahn's Algorithm) ────────────────────────
    const executionOrder = ForgeGraphCompiler._topologicalSort(graph, nodeMap)

    // ── 3. Wire Allocation ────────────────────────────────────────────
    const { wireBuffer, portIndexMap, totalWireSlots } =
      ForgeGraphCompiler._allocateWires(executionOrder, nodeMap)

    // ── 4. State Allocation ───────────────────────────────────────────
    const { stateBuffer, stateOffsetMap, totalStateSlots } =
      ForgeGraphCompiler._allocateState(executionOrder, nodeMap)

    // ── 5. Build Edge Wiring ──────────────────────────────────────────
    const { edgeWiring, edgeCount } =
      ForgeGraphCompiler._buildEdgeWiring(graph, portIndexMap)

    // ── 6. Build Program ──────────────────────────────────────────────
    const program = ForgeGraphCompiler._buildProgram(
      executionOrder, nodeMap, portIndexMap, stateOffsetMap,
    )

    // ── 7. Extract Input/Output Maps ──────────────────────────────────
    const inputMap = new Map<string, number>()
    const audioInputMap = new Map<string, number>()
    let beatInputIndex = -1
    let bpmInputIndex = -1
    let energyInputIndex = -1
    let timeInputIndex = -1
    const outputs: CompiledOutput[] = []

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!
      switch (node.type) {
        case 'input_dmx': {
          const cfg = node.config as IInputDmxConfig
          const outPort = node.outputs[0]
          if (outPort) {
            const wireIdx = portIndexMap.get(`${nodeId}:out:${outPort.id}`)
            if (wireIdx !== undefined) inputMap.set(cfg.channelKey, wireIdx)
          }
          break
        }
        case 'input_audio_band': {
          const cfg = node.config as IInputAudioBandConfig
          const outPort = node.outputs[0]
          if (outPort) {
            const wireIdx = portIndexMap.get(`${nodeId}:out:${outPort.id}`)
            if (wireIdx !== undefined) audioInputMap.set(cfg.band, wireIdx)
          }
          break
        }
        case 'input_beat': {
          const outPort = node.outputs[0]
          if (outPort) {
            beatInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1
          }
          break
        }
        case 'input_bpm': {
          const outPort = node.outputs[0]
          if (outPort) {
            bpmInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1
          }
          break
        }
        case 'input_energy': {
          const outPort = node.outputs[0]
          if (outPort) {
            energyInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1
          }
          break
        }
        case 'input_time': {
          const outPort = node.outputs[0]
          if (outPort) {
            timeInputIndex = portIndexMap.get(`${nodeId}:out:${outPort.id}`) ?? -1
          }
          break
        }
        case 'output_dmx': {
          const cfg = node.config as IOutputDmxConfig
          // The input port of the output_dmx node carries the final normalized value
          const inPort = node.inputs[0]
          if (inPort) {
            const wireIdx = portIndexMap.get(`${nodeId}:in:${inPort.id}`)
            if (wireIdx !== undefined) {
              outputs.push({
                wireIndex: wireIdx,
                dmxOffset: cfg.dmxOffset,
                defaultDmxValue: cfg.defaultDmxValue,
                is16bit: cfg.is16bit ?? false,
              })
            }
          }
          break
        }
      }
    }

    // Sort outputs by dmxOffset for sequential DMX writes
    outputs.sort((a, b) => a.dmxOffset - b.dmxOffset)

    return {
      fixtureId,
      wireBuffer,
      totalWireSlots,
      stateBuffer,
      totalStateSlots,
      program,
      edgeWiring,
      edgeCount,
      inputMap,
      audioInputMap,
      beatInputIndex,
      bpmInputIndex,
      energyInputIndex,
      timeInputIndex,
      outputs,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Topological Sort (Kahn's BFS)
  // ═══════════════════════════════════════════════════════════════════════

  private static _topologicalSort(
    graph: IForgeNodeGraph,
    nodeMap: Map<ForgeNodeId, IForgeNode>,
  ): ForgeNodeId[] {
    const inDegree = new Map<ForgeNodeId, number>()
    const adjacency = new Map<ForgeNodeId, ForgeNodeId[]>()

    // Initialize
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0)
      adjacency.set(node.id, [])
    }

    // Count incoming edges per node
    for (const edge of graph.edges) {
      const prev = inDegree.get(edge.targetNode) ?? 0
      inDegree.set(edge.targetNode, prev + 1)

      const adj = adjacency.get(edge.sourceNode)
      if (adj) adj.push(edge.targetNode)
    }

    // BFS: enqueue nodes with inDegree === 0
    const queue: ForgeNodeId[] = []
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0) queue.push(nodeId)
    }

    const result: ForgeNodeId[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      const successors = adjacency.get(current) ?? []
      for (const succ of successors) {
        const newDeg = (inDegree.get(succ) ?? 1) - 1
        inDegree.set(succ, newDeg)
        if (newDeg === 0) queue.push(succ)
      }
    }

    if (result.length < graph.nodes.length) {
      // Cycle detected — push remaining nodes at the end with warning
      // (proc_delay nodes may cause valid cycles in future; for v1 we
      //  append them to avoid crashing the compiler)
      console.warn(
        `[ForgeGraphCompiler] Cycle detected: ${graph.nodes.length - result.length} nodes unreachable. Appending at end.`,
      )
      const inResult = new Set(result)
      for (const node of graph.nodes) {
        if (!inResult.has(node.id)) result.push(node.id)
      }
    }

    return result
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Wire Allocation (port → Float64Array index)
  // ═══════════════════════════════════════════════════════════════════════

  private static _allocateWires(
    executionOrder: ForgeNodeId[],
    nodeMap: Map<ForgeNodeId, IForgeNode>,
  ): { wireBuffer: Float64Array; portIndexMap: Map<string, number>; totalWireSlots: number } {
    const portIndexMap = new Map<string, number>()
    let portIndex = 0

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!
      for (const port of node.inputs) {
        portIndexMap.set(`${nodeId}:in:${port.id}`, portIndex++)
      }
      for (const port of node.outputs) {
        portIndexMap.set(`${nodeId}:out:${port.id}`, portIndex++)
      }
    }

    return {
      wireBuffer: new Float64Array(portIndex),
      portIndexMap,
      totalWireSlots: portIndex,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — State Allocation (stateful nodes → Float64Array offsets)
  // ═══════════════════════════════════════════════════════════════════════

  private static _allocateState(
    executionOrder: ForgeNodeId[],
    nodeMap: Map<ForgeNodeId, IForgeNode>,
  ): { stateBuffer: Float64Array; stateOffsetMap: Map<string, number>; totalStateSlots: number } {
    const stateOffsetMap = new Map<string, number>()
    let stateOffset = 0

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!
      stateOffsetMap.set(nodeId, stateOffset)
      stateOffset += getStateSlots(node)
    }

    return {
      stateBuffer: new Float64Array(stateOffset),
      stateOffsetMap,
      totalStateSlots: stateOffset,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Edge Wiring (edges → Uint32Array of [src, dst] pairs)
  // ═══════════════════════════════════════════════════════════════════════

  private static _buildEdgeWiring(
    graph: IForgeNodeGraph,
    portIndexMap: Map<string, number>,
  ): { edgeWiring: Uint32Array; edgeCount: number } {
    const pairs: number[] = []

    for (const edge of graph.edges) {
      const srcKey = `${edge.sourceNode}:out:${edge.sourcePort}`
      const dstKey = `${edge.targetNode}:in:${edge.targetPort}`
      const srcIdx = portIndexMap.get(srcKey)
      const dstIdx = portIndexMap.get(dstKey)

      if (srcIdx !== undefined && dstIdx !== undefined) {
        pairs.push(srcIdx, dstIdx)
      } else {
        console.warn(
          `[ForgeGraphCompiler] Edge ${edge.id}: unmapped port (src=${srcKey} dst=${dstKey}). Skipping.`,
        )
      }
    }

    return {
      edgeWiring: new Uint32Array(pairs),
      edgeCount: pairs.length / 2,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Program Build (executionOrder → CompiledInstruction[])
  // ═══════════════════════════════════════════════════════════════════════

  private static _buildProgram(
    executionOrder: ForgeNodeId[],
    nodeMap: Map<ForgeNodeId, IForgeNode>,
    portIndexMap: Map<string, number>,
    stateOffsetMap: Map<string, number>,
  ): CompiledInstruction[] {
    const program: CompiledInstruction[] = []

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!
      const opcode = OPCODE_MAP[node.type] ?? 0

      // Resolve port offsets
      let inputOffset = 0
      let outputOffset = 0

      if (node.inputs.length > 0) {
        inputOffset = portIndexMap.get(`${nodeId}:in:${node.inputs[0].id}`) ?? 0
      }
      if (node.outputs.length > 0) {
        outputOffset = portIndexMap.get(`${nodeId}:out:${node.outputs[0].id}`) ?? 0
      }

      program.push({
        opcode,
        inputOffset,
        inputCount: node.inputs.length,
        outputOffset,
        outputCount: node.outputs.length,
        stateOffset: stateOffsetMap.get(nodeId) ?? 0,
        stateSlots: getStateSlots(node),
        params: extractParams(node),
      })
    }

    return program
  }
}
