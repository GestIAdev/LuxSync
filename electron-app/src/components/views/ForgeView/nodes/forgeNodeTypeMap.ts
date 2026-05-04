/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️  FORGE NODE TYPE MAP — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registra los custom node React components para @xyflow/react.
 * Cada ForgeNodeType se mapea al componente visual correcto
 * (uno por categoría, con variantes internas).
 *
 * También exporta la función buildNodeData() que convierte
 * IForgeNode → XYFlow NodeData con todos los campos que
 * los componentes custom necesitan.
 *
 * @module components/views/ForgeView/nodes/forgeNodeTypeMap
 * @version WAVE 4548.8c
 */

import type { NodeTypes } from '@xyflow/react'
import type {
  IForgeNode,
  ForgeNodeType,
  IProcLfoConfig,
  IProcMathConfig,
  IProcMapRangeConfig,
  IProcSmoothConfig,
  IProcClampConfig,
  IProcDelayConfig,
  IProcMergeConfig,
  IProcCurveConfig,
  ILogicThresholdConfig,
  ILogicCounterConfig,
  ILogicSwitchConfig,
  IInputDmxConfig,
  IInputAudioBandConfig,
  IInputConstantConfig,
  IOutputDmxConfig,
  ICompoundIngenioConfig,
} from '../../../../core/forge/types'
import type { ForgeNodeBaseData } from './ForgeNodeBase'
import { ForgeInputNode } from './ForgeInputNode'
import { ForgeProcessNode } from './ForgeProcessNode'
import { ForgeLogicNode } from './ForgeLogicNode'
import { ForgeOutputNode } from './ForgeOutputNode'
import { ForgeCompoundNode } from './ForgeCompoundNode'

// ═══════════════════════════════════════════════════════════════════════════
// NODE TYPE MAP — @xyflow/react nodeTypes prop
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Objeto que se pasa al prop `nodeTypes` de ReactFlow.
 * Cada ForgeNodeType → componente React correcto.
 *
 * Cast necesario: @xyflow/react v12 NodeTypes usa Node<Record<string,unknown>>
 * mientras nuestros componentes están tipados con Node<ForgeNodeBaseData>.
 * La varianza del genérico lo hace incompatible sin el cast, aunque en
 * runtime es completamente correcto (ForgeNodeBaseData extends Record<string,unknown>).
 */
export const FORGE_NODE_TYPE_MAP = {
  // Input
  input_dmx:         ForgeInputNode,
  input_audio_band:  ForgeInputNode,
  input_beat:        ForgeInputNode,
  input_bpm:         ForgeInputNode,
  input_energy:      ForgeInputNode,
  input_constant:    ForgeInputNode,
  input_time:        ForgeInputNode,
  // Process
  proc_lfo:          ForgeProcessNode,
  proc_smooth:       ForgeProcessNode,
  proc_map_range:    ForgeProcessNode,
  proc_math:         ForgeProcessNode,
  proc_clamp:        ForgeProcessNode,
  proc_delay:        ForgeProcessNode,
  proc_merge:        ForgeProcessNode,
  proc_invert:       ForgeProcessNode,
  proc_curve:        ForgeProcessNode,
  // Logic
  logic_threshold:   ForgeLogicNode,
  logic_gate:        ForgeLogicNode,
  logic_switch:      ForgeLogicNode,
  logic_and:         ForgeLogicNode,
  logic_or:          ForgeLogicNode,
  logic_counter:     ForgeLogicNode,
  // Output
  output_dmx:        ForgeOutputNode,
  // Compound
  compound_ingenio:  ForgeCompoundNode,
} as NodeTypes

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG PREVIEW — Genera texto de resumen para cada tipo
// ═══════════════════════════════════════════════════════════════════════════

function buildConfigPreview(node: IForgeNode): string {
  const { type, config } = node

  switch (type) {
    case 'proc_lfo': {
      const c = config as IProcLfoConfig
      const freq = c.syncToBpm ? `÷${c.bpmDivisor} BPM` : `${c.frequencyHz.toFixed(2)} Hz`
      return `${c.waveform} · ${freq}`
    }
    case 'proc_smooth': {
      const c = config as IProcSmoothConfig
      return `atk ${c.attackMs}ms · rel ${c.releaseMs}ms`
    }
    case 'proc_math': {
      const c = config as IProcMathConfig
      return `op: ${c.operation}`
    }
    case 'proc_map_range': {
      const c = config as IProcMapRangeConfig
      return `[${c.inputMin},${c.inputMax}]→[${c.outputMin},${c.outputMax}]`
    }
    case 'proc_clamp': {
      const c = config as IProcClampConfig
      return `clamp [${c.min}, ${c.max}]`
    }
    case 'proc_delay': {
      const c = config as IProcDelayConfig
      return `${c.delayFrames} frames`
    }
    case 'proc_merge': {
      const c = config as IProcMergeConfig
      return `strategy: ${c.strategy}`
    }
    case 'proc_curve': {
      const c = config as IProcCurveConfig
      return `curve: ${c.curveType}`
    }
    case 'logic_threshold': {
      const c = config as ILogicThresholdConfig
      return `threshold: ${c.threshold.toFixed(2)}`
    }
    case 'logic_counter': {
      const c = config as ILogicCounterConfig
      return `mod ${c.modulo} · ${c.emitNormalized ? 'norm' : 'raw'}`
    }
    case 'logic_switch': {
      const c = config as ILogicSwitchConfig
      return `switch @ ${c.switchThreshold.toFixed(2)}`
    }
    case 'input_dmx': {
      const c = config as IInputDmxConfig
      return `ch: ${c.channelKey}`
    }
    case 'input_audio_band': {
      const c = config as IInputAudioBandConfig
      return `band: ${c.band}`
    }
    case 'input_constant': {
      const c = config as IInputConstantConfig
      return `value: ${c.value.toFixed(3)}`
    }
    case 'output_dmx': {
      const c = config as IOutputDmxConfig
      return `${c.channelType} · offset ${c.dmxOffset}`
    }
    case 'compound_ingenio': {
      const c = config as ICompoundIngenioConfig
      return c.ingenioName
    }
    default:
      return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD NODE DATA — IForgeNode → XYFlow NodeData
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte un IForgeNode a los datos que esperan los custom node components.
 * Se usa en forgeNodeToXY() del NodeCanvas.
 */
export function buildNodeData(node: IForgeNode): ForgeNodeBaseData {
  return {
    forgeType:     node.type,
    forgeCategory: node.category,
    label:         node.label ?? node.type,
    inputs:        node.inputs.map((p) => ({
      id:        p.id,
      label:     p.label,
      dataType:  p.dataType,
      direction: p.direction,
    })),
    outputs:       node.outputs.map((p) => ({
      id:        p.id,
      label:     p.label,
      dataType:  p.dataType,
      direction: p.direction,
    })),
    configPreview: buildConfigPreview(node),
  }
}
