/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 FORGE PALETTE — WAVE 4548.8b
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Catálogo arrastrable de nodos disponibles en el canvas Forge.
 * Cada PaletteEntry tiene:
 *  - Metadatos de UI (label, descripción, icono emoji)
 *  - createNode(id, position): factory que devuelve un IForgeNode válido
 *    con config inicializada con los defaults más lógicos.
 *
 * PRINCIPIO: Las factories producen objetos INMUTABLES que cumplen
 * exactamente IForgeNode. Valores de defaultValue de puertos alineados
 * con los rangos esperados por el evaluador.
 *
 * @module components/views/ForgeView/palette/forgePalette
 * @version WAVE 4548.8b
 */

import type {
  ForgeNodeId,
  ForgeNodeCategory,
  ForgeNodeType,
  IForgeNode,
  IForgePort,
} from '../../../../core/forge/types'

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE ENTRY — Un nodo disponible en la UI
// ═══════════════════════════════════════════════════════════════════════════

export interface PaletteEntry {
  /** Tipo Forge del nodo */
  type: ForgeNodeType
  /** Categoría a la que pertenece (para accordion) */
  category: ForgeNodeCategory
  /** Label en la paleta */
  label: string
  /** Descripción corta para tooltip */
  description: string
  /** Emoji/icono */
  icon: string
  /** Factory — devuelve el IForgeNode listo para insertar en el grafo */
  createNode: (id: ForgeNodeId, position: { x: number; y: number }) => IForgeNode
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT HELPERS — builders para no repetir la firma completa
// ═══════════════════════════════════════════════════════════════════════════

function inPort(
  id: string,
  label: string,
  dataType: IForgePort['dataType'],
  defaultValue = 0
): IForgePort {
  return { id, label, dataType, direction: 'in', defaultValue, required: true }
}

function outPort(
  id: string,
  label: string,
  dataType: IForgePort['dataType']
): IForgePort {
  return { id, label, dataType, direction: 'out', defaultValue: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: INPUT
// ═══════════════════════════════════════════════════════════════════════════

function createInputDmxNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'input_dmx',
    category: 'input',
    label: 'DMX Input',
    uiPosition: position,
    inputs: [],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'input_dmx', channelKey: 'dimmer' },
  }
}

function createInputAudioBandNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'input_audio_band',
    category: 'input',
    label: 'Audio Band',
    uiPosition: position,
    inputs: [],
    outputs: [outPort('output', 'energy', 'normalized')],
    config: { nodeType: 'input_audio_band', band: 'bass' },
  }
}

function createInputBeatNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'input_beat',
    category: 'input',
    label: 'Beat Pulse',
    uiPosition: position,
    inputs: [],
    outputs: [outPort('output', 'beat', 'boolean')],
    config: { nodeType: 'input_constant', value: 0 },
  }
}

function createInputConstantNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'input_constant',
    category: 'input',
    label: 'Constant',
    uiPosition: position,
    inputs: [],
    outputs: [outPort('output', 'value', 'normalized')],
    config: { nodeType: 'input_constant', value: 1.0 },
  }
}

function createInputEnergyNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'input_energy',
    category: 'input',
    label: 'Audio Energy',
    uiPosition: position,
    inputs: [],
    outputs: [outPort('output', 'rms', 'normalized')],
    config: { nodeType: 'input_constant', value: 0 },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: PROCESS
// ═══════════════════════════════════════════════════════════════════════════

function createProcLfoNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_lfo',
    category: 'process',
    label: 'LFO',
    uiPosition: position,
    inputs: [
      inPort('amplitude', 'amplitude', 'normalized', 1.0),
      inPort('modulation', 'mod rate', 'normalized', 0),
    ],
    outputs: [outPort('output', 'output', 'normalized')],
    config: {
      nodeType: 'proc_lfo',
      waveform: 'sine',
      frequencyHz: 1.0,
      syncToBpm: false,
      bpmDivisor: 1,
      phase: 0,
    },
  }
}

function createProcMathNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_math',
    category: 'process',
    label: 'Math',
    uiPosition: position,
    inputs: [
      inPort('a', 'A', 'normalized', 0),
      inPort('b', 'B', 'normalized', 1.0),
    ],
    outputs: [outPort('output', 'result', 'normalized')],
    config: { nodeType: 'proc_math', operation: 'multiply' },
  }
}

function createProcSmoothNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_smooth',
    category: 'process',
    label: 'Smooth',
    uiPosition: position,
    inputs: [inPort('input', 'input', 'normalized', 0)],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'proc_smooth', attackMs: 200, releaseMs: 400 },
  }
}

function createProcMapRangeNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_map_range',
    category: 'process',
    label: 'Map Range',
    uiPosition: position,
    inputs: [inPort('input', 'input', 'normalized', 0)],
    outputs: [outPort('output', 'output', 'normalized')],
    config: {
      nodeType: 'proc_map_range',
      inputMin: 0,
      inputMax: 1,
      outputMin: 0,
      outputMax: 1,
    },
  }
}

function createProcClampNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_clamp',
    category: 'process',
    label: 'Clamp',
    uiPosition: position,
    inputs: [inPort('input', 'input', 'unbounded', 0)],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'proc_clamp', min: 0, max: 1 },
  }
}

function createProcInvertNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'proc_invert',
    category: 'process',
    label: 'Invert',
    uiPosition: position,
    inputs: [inPort('input', 'input', 'normalized', 0)],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'empty' },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function createLogicCounterNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'logic_counter',
    category: 'logic',
    label: 'Counter',
    uiPosition: position,
    inputs: [
      inPort('trigger', 'trigger', 'boolean', 0),
      inPort('reset', 'reset', 'boolean', 0),
    ],
    outputs: [outPort('output', 'count', 'normalized')],
    config: { nodeType: 'logic_counter', modulo: 4, emitNormalized: true },
  }
}

function createLogicThresholdNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'logic_threshold',
    category: 'logic',
    label: 'Threshold',
    uiPosition: position,
    inputs: [inPort('input', 'input', 'normalized', 0)],
    outputs: [outPort('output', 'gate', 'boolean')],
    config: { nodeType: 'logic_threshold', threshold: 0.5, hysteresis: 0.05 },
  }
}

function createLogicGateNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'logic_gate',
    category: 'logic',
    label: 'Gate',
    uiPosition: position,
    inputs: [
      inPort('signal', 'signal', 'normalized', 0),
      inPort('gate', 'gate', 'boolean', 0),
    ],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'empty' },
  }
}

function createLogicSwitchNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'logic_switch',
    category: 'logic',
    label: 'Switch',
    uiPosition: position,
    inputs: [
      inPort('input_a', 'A', 'normalized', 0),
      inPort('input_b', 'B', 'normalized', 0),
      inPort('selector', 'selector', 'boolean', 0),
    ],
    outputs: [outPort('output', 'output', 'normalized')],
    config: { nodeType: 'logic_switch', switchThreshold: 0.5 },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

function createOutputDmxNode(id: ForgeNodeId, position: { x: number; y: number }): IForgeNode {
  return {
    id,
    type: 'output_dmx',
    category: 'output',
    label: 'DMX Output',
    uiPosition: position,
    inputs: [inPort('input', 'value', 'normalized', 0)],
    outputs: [],
    config: {
      nodeType: 'output_dmx',
      channelType: 'dimmer',
      dmxOffset: 0,
      defaultDmxValue: 0,
      is16bit: false,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE_PALETTE — Catálogo completo por categoría
// ═══════════════════════════════════════════════════════════════════════════

export const FORGE_PALETTE: Record<ForgeNodeCategory, PaletteEntry[]> = {
  input: [
    {
      type: 'input_dmx',
      category: 'input',
      label: 'DMX Input',
      description: 'Recibe un canal DMX del IntentBus (dimmer, pan, tilt, R, G, B...)',
      icon: '📥',
      createNode: createInputDmxNode,
    },
    {
      type: 'input_audio_band',
      category: 'input',
      label: 'Audio Band',
      description: 'Energía de una banda de frecuencia (bass, mid, air...)',
      icon: '🎵',
      createNode: createInputAudioBandNode,
    },
    {
      type: 'input_beat',
      category: 'input',
      label: 'Beat Pulse',
      description: 'Emite 1.0 en cada beat del BPM detector',
      icon: '🥁',
      createNode: createInputBeatNode,
    },
    {
      type: 'input_energy',
      category: 'input',
      label: 'Audio Energy',
      description: 'Energía global RMS del audio',
      icon: '⚡',
      createNode: createInputEnergyNode,
    },
    {
      type: 'input_constant',
      category: 'input',
      label: 'Constant',
      description: 'Emite un valor fijo configurable (0.0 – 1.0)',
      icon: '🔢',
      createNode: createInputConstantNode,
    },
  ],
  process: [
    {
      type: 'proc_lfo',
      category: 'process',
      label: 'LFO',
      description: 'Oscilador de baja frecuencia (sine, square, saw, triangle)',
      icon: '∿',
      createNode: createProcLfoNode,
    },
    {
      type: 'proc_math',
      category: 'process',
      label: 'Math',
      description: 'Operación aritmética: add, subtract, multiply, divide',
      icon: '±',
      createNode: createProcMathNode,
    },
    {
      type: 'proc_smooth',
      category: 'process',
      label: 'Smooth',
      description: 'Suavizado exponencial con ataque y release configurables',
      icon: '〜',
      createNode: createProcSmoothNode,
    },
    {
      type: 'proc_map_range',
      category: 'process',
      label: 'Map Range',
      description: 'Re-mapeo lineal de rango [a,b] → [c,d]',
      icon: '↔',
      createNode: createProcMapRangeNode,
    },
    {
      type: 'proc_clamp',
      category: 'process',
      label: 'Clamp',
      description: 'Clamp a un rango [min, max]',
      icon: '⬜',
      createNode: createProcClampNode,
    },
    {
      type: 'proc_invert',
      category: 'process',
      label: 'Invert',
      description: '1.0 - input',
      icon: '↕',
      createNode: createProcInvertNode,
    },
  ],
  logic: [
    {
      type: 'logic_counter',
      category: 'logic',
      label: 'Counter',
      description: 'Cuenta pulsos, resetea en N (módulo counter)',
      icon: '🔢',
      createNode: createLogicCounterNode,
    },
    {
      type: 'logic_threshold',
      category: 'logic',
      label: 'Threshold',
      description: 'Si input > threshold → 1.0, sino → 0.0 (con histéresis)',
      icon: '⚖',
      createNode: createLogicThresholdNode,
    },
    {
      type: 'logic_gate',
      category: 'logic',
      label: 'Gate',
      description: 'Deja pasar la señal solo cuando gate > 0.5',
      icon: '🚪',
      createNode: createLogicGateNode,
    },
    {
      type: 'logic_switch',
      category: 'logic',
      label: 'Switch',
      description: 'Selecciona entre input A o B según selector',
      icon: '🔀',
      createNode: createLogicSwitchNode,
    },
  ],
  output: [
    {
      type: 'output_dmx',
      category: 'output',
      label: 'DMX Output',
      description: 'Salida a un canal DMX físico (offset relativo al parche)',
      icon: '📤',
      createNode: createOutputDmxNode,
    },
  ],
  // Sin compound por ahora — compound_ingenio está pendiente para N6+
  compound: [],
}

// Lista plana de todas las entradas (para drag-drop lookup)
export const ALL_PALETTE_ENTRIES: PaletteEntry[] = (
  Object.values(FORGE_PALETTE) as PaletteEntry[][]
).flat()

/** Busca la entry de paleta por tipo */
export function getPaletteEntry(type: ForgeNodeType): PaletteEntry | undefined {
  return ALL_PALETTE_ENTRIES.find((e) => e.type === type)
}
