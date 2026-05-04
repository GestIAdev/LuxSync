/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE GRAPH — TYPE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.2: Los átomos del nuevo grafo de nodos de la Forja.
 *
 * Este archivo define la totalidad del sistema de tipos para el
 * Forge NodeGraph — el grafo de nodos a nivel de **fixture definition**
 * (design-time). NO confundir con el Aether NodeGraph (runtime, 44Hz).
 *
 * El Forge NodeGraph describe la lógica interna de un fixture:
 * qué entradas recibe (DMX, audio, beat), qué transformaciones aplica
 * (LFO, math, smooth), y qué canales DMX físicos produce como salida.
 *
 * PRINCIPIO: Todas las interfaces son readonly. La inmutabilidad
 * estructural es un contrato — la mutación solo ocurre creando
 * nuevas instancias (patch time), nunca in-place.
 *
 * @module core/forge/types
 * @version WAVE 4548.2
 */

import type { ChannelType, FixtureChannel, FixtureDefinition } from '../../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** ID único de un nodo dentro del grafo del fixture */
export type ForgeNodeId = string

/** ID único de un puerto dentro de un nodo */
export type ForgePortId = string

/** ID único de una conexión */
export type ForgeEdgeId = string

// ═══════════════════════════════════════════════════════════════════════════
// PORT — Punto de conexión atómico
// ═══════════════════════════════════════════════════════════════════════════

/** Tipos de dato que fluyen por los puertos */
export type ForgeDataType =
  | 'normalized'   // 0.0 – 1.0 (dimmer, color component, position)
  | 'dmx'          // 0 – 255 (raw DMX output)
  | 'boolean'      // 0.0 | 1.0 (gate open/closed)
  | 'frequency'    // Hz (LFO rate, BPM-derived)
  | 'angle'        // 0.0 – 1.0 representing 0° – 360° (phase)
  | 'unbounded'    // Any float (intermediate math results)

export interface IForgePort {
  /** ID único dentro del nodo (e.g. "value", "r", "g", "b") */
  readonly id: ForgePortId
  /** Etiqueta para la UI */
  readonly label: string
  /** Tipo de dato que acepta/emite */
  readonly dataType: ForgeDataType
  /** Dirección: entrada o salida */
  readonly direction: 'in' | 'out'
  /** Valor por defecto cuando el puerto no está conectado */
  readonly defaultValue: number
  /**
   * ¿Es un puerto requerido? (solo para inputs)
   * Si true y no está conectado, el evaluador usa defaultValue.
   * Si false y no está conectado, el puerto se ignora en la evaluación.
   */
  readonly required?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE CATEGORIES & TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categoría funcional de un ForgeNode.
 * Determina dónde aparece en la paleta de la UI y cómo se evalúa.
 */
export type ForgeNodeCategory =
  | 'input'      // Fuentes de dato (DMX input, audio band, beat, timer, constant)
  | 'process'    // Transformaciones matemáticas (math, LFO, smooth, map, delay)
  | 'logic'      // Lógica condicional (threshold, gate, switch, AND, OR)
  | 'output'     // Salida DMX física (dimmer, pan, tilt, red, green, blue, custom)
  | 'compound'   // Sub-graph empaquetado ("INGENIO")

/**
 * Tipo concreto de un ForgeNode.
 * Cada tipo tiene una firma de puertos fija (inputs/outputs predefinidos)
 * y una función de evaluación determinista.
 */
export type ForgeNodeType =
  // ── INPUT NODES ──────────────────────────────────────────────────────
  | 'input_dmx'          // Recibe valor DMX del IntentBus (Aether L0-L3+)
  | 'input_audio_band'   // Recibe energía de una banda de frecuencia
  | 'input_beat'         // Emite pulso en cada beat (BPM-synced)
  | 'input_bpm'          // Emite BPM actual como valor normalizado
  | 'input_energy'       // Emite energía global RMS
  | 'input_constant'     // Emite un valor fijo configurable
  | 'input_time'         // Emite tiempo transcurrido (ms) como ramp
  // ── PROCESS NODES ────────────────────────────────────────────────────
  | 'proc_lfo'           // Oscilador (sine, triangle, saw, square, random)
  | 'proc_smooth'        // Suavizado exponencial (attack/release)
  | 'proc_map_range'     // Re-mapeo lineal de rango [a,b] → [c,d]
  | 'proc_math'          // Operación aritmética (add, multiply, subtract, divide)
  | 'proc_clamp'         // Clamp a [min, max]
  | 'proc_delay'         // Retardo temporal en frames (ring buffer)
  | 'proc_merge'         // Combina N inputs con estrategia (max, min, avg, sum)
  | 'proc_invert'        // 1.0 - input
  | 'proc_curve'         // Aplica TransferCurve (exponential, logarithmic, scurve)
  // ── LOGIC NODES ──────────────────────────────────────────────────────
  | 'logic_threshold'    // Si input > threshold → 1.0, sino → 0.0
  | 'logic_gate'         // Deja pasar signal solo si gate > 0.5
  | 'logic_switch'       // Selecciona entre input_a / input_b según selector
  | 'logic_and'          // Ambos inputs > 0.5 → 1.0
  | 'logic_or'           // Algún input > 0.5 → 1.0
  | 'logic_counter'      // Cuenta pulsos, resetea en N (modulo counter)
  // ── OUTPUT NODES ─────────────────────────────────────────────────────
  | 'output_dmx'         // Salida a canal DMX físico (el "slot" final)
  // ── COMPOUND NODES ───────────────────────────────────────────────────
  | 'compound_ingenio'   // Sub-graph empaquetado (INGENIO)

// ═══════════════════════════════════════════════════════════════════════════
// NODE CONFIG — Datos internos configurables por tipo
// Discriminated union via `nodeType` field.
// ═══════════════════════════════════════════════════════════════════════════

export interface IInputDmxConfig {
  readonly nodeType: 'input_dmx'
  /** Canal Aether que este nodo lee del IntentBus. E.g. 'dimmer', 'pan', 'r' */
  readonly channelKey: string
}

export interface IInputAudioBandConfig {
  readonly nodeType: 'input_audio_band'
  /** Banda de frecuencia */
  readonly band: 'subBass' | 'bass' | 'mid' | 'highMid' | 'presence' | 'air'
}

export interface IInputConstantConfig {
  readonly nodeType: 'input_constant'
  /** Valor fijo emitido (0.0 – 1.0) */
  readonly value: number
}

export interface IProcLfoConfig {
  readonly nodeType: 'proc_lfo'
  /** Forma de onda */
  readonly waveform: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'random_hold'
  /** Frecuencia en Hz (si fijo) */
  readonly frequencyHz: number
  /** ¿Sincronizar al BPM? Si true, frequencyHz se ignora y se usa bpmDivisor */
  readonly syncToBpm: boolean
  /** Divisor de BPM (1 = cada beat, 2 = cada 2 beats, 0.5 = 2x por beat) */
  readonly bpmDivisor: number
  /** Fase inicial (0.0 – 1.0) */
  readonly phase: number
}

export interface IProcSmoothConfig {
  readonly nodeType: 'proc_smooth'
  /** Tiempo de ataque en ms (transición hacia arriba) */
  readonly attackMs: number
  /** Tiempo de release en ms (transición hacia abajo) */
  readonly releaseMs: number
}

export interface IProcMapRangeConfig {
  readonly nodeType: 'proc_map_range'
  readonly inputMin: number
  readonly inputMax: number
  readonly outputMin: number
  readonly outputMax: number
}

export interface IProcMathConfig {
  readonly nodeType: 'proc_math'
  readonly operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power'
}

export interface IProcClampConfig {
  readonly nodeType: 'proc_clamp'
  readonly min: number
  readonly max: number
}

export interface IProcDelayConfig {
  readonly nodeType: 'proc_delay'
  /** Retardo en frames (a 44Hz, 1 frame ≈ 22.7ms) */
  readonly delayFrames: number
}

export interface IProcMergeConfig {
  readonly nodeType: 'proc_merge'
  readonly strategy: 'max' | 'min' | 'average' | 'sum'
}

export interface IProcCurveConfig {
  readonly nodeType: 'proc_curve'
  readonly curveType: 'linear' | 'exponential' | 'logarithmic' | 'scurve' | 'gamma'
  readonly exponent?: number
  readonly gamma?: number
}

export interface ILogicThresholdConfig {
  readonly nodeType: 'logic_threshold'
  readonly threshold: number
  /** Dead zone para evitar oscilación (default: 0.05) */
  readonly hysteresis: number
}

export interface ILogicCounterConfig {
  readonly nodeType: 'logic_counter'
  /** Resetea al llegar a este valor */
  readonly modulo: number
  /** true = emite count/modulo (normalized), false = emite count raw */
  readonly emitNormalized: boolean
}

export interface ILogicSwitchConfig {
  readonly nodeType: 'logic_switch'
  /** Si selector > threshold, usa input_b */
  readonly switchThreshold: number
}

export interface IOutputDmxConfig {
  readonly nodeType: 'output_dmx'
  /** Tipo de canal DMX que este nodo produce */
  readonly channelType: ChannelType
  /** Offset DMX relativo a la dirección base del Device (0-indexed) */
  readonly dmxOffset: number
  /** Nombre legible del canal (para canales custom) */
  readonly channelName?: string
  /** Default value DMX (0–255) cuando nada está conectado al input */
  readonly defaultDmxValue: number
  /** ¿Es canal de 16-bit? Si true, ocupa dmxOffset y dmxOffset+1 */
  readonly is16bit?: boolean
  /** ¿Rotación continua? (convención DMX: 0-127 CW, 128 stop, 129-255 CCW) */
  readonly continuousRotation?: boolean
}

export interface ICompoundIngenioConfig {
  readonly nodeType: 'compound_ingenio'
  /** Nombre del INGENIO (e.g. "Fan Speed Controller", "Mirror Ball Sequence") */
  readonly ingenioName: string
  /** Sub-graph completo empaquetado como IForgeNodeGraph recursivo */
  readonly subGraph: IForgeNodeGraph
  /** Mapeo de puertos expuestos del INGENIO a nodos internos del sub-graph */
  readonly portMapping: {
    readonly inputs: ReadonlyArray<{
      readonly exposedPortId: ForgePortId
      readonly internalNodeId: ForgeNodeId
      readonly internalPortId: ForgePortId
    }>
    readonly outputs: ReadonlyArray<{
      readonly exposedPortId: ForgePortId
      readonly internalNodeId: ForgeNodeId
      readonly internalPortId: ForgePortId
    }>
  }
}

export interface IEmptyConfig {
  readonly nodeType: 'empty'
}

/**
 * Configuración interna de un ForgeNode.
 * Discriminated union via `nodeType`.
 */
export type IForgeNodeConfig =
  | IInputDmxConfig
  | IInputAudioBandConfig
  | IInputConstantConfig
  | IProcLfoConfig
  | IProcSmoothConfig
  | IProcMapRangeConfig
  | IProcMathConfig
  | IProcClampConfig
  | IProcDelayConfig
  | IProcMergeConfig
  | IProcCurveConfig
  | ILogicThresholdConfig
  | ILogicCounterConfig
  | ILogicSwitchConfig
  | IOutputDmxConfig
  | ICompoundIngenioConfig
  | IEmptyConfig

// ═══════════════════════════════════════════════════════════════════════════
// FORGE NODE — El átomo del grafo
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgeNode {
  /** ID único dentro del grafo */
  readonly id: ForgeNodeId
  /** Tipo concreto del nodo (determina la función de evaluación) */
  readonly type: ForgeNodeType
  /** Categoría (para la UI: sección de la paleta) */
  readonly category: ForgeNodeCategory
  /** Puertos de entrada */
  readonly inputs: readonly IForgePort[]
  /** Puertos de salida */
  readonly outputs: readonly IForgePort[]
  /** Configuración interna del nodo */
  readonly config: IForgeNodeConfig
  /** Posición en el canvas de la UI (píxeles). Solo para rendering, no afecta evaluación. */
  readonly uiPosition: { readonly x: number; readonly y: number }
  /** Etiqueta legible para la UI */
  readonly label?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE EDGE — Conexión entre puertos
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgeEdge {
  /** ID único de la conexión */
  readonly id: ForgeEdgeId
  /** Nodo de origen */
  readonly sourceNode: ForgeNodeId
  /** Puerto de salida del nodo origen */
  readonly sourcePort: ForgePortId
  /** Nodo de destino */
  readonly targetNode: ForgeNodeId
  /** Puerto de entrada del nodo destino */
  readonly targetPort: ForgePortId
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE GRAPH METADATA
// ═══════════════════════════════════════════════════════════════════════════

export interface ForgeGraphMeta {
  /** Fecha de creación del grafo (ISO 8601) */
  readonly createdAt: string
  /** WAVE que generó este grafo */
  readonly generatorWave: string
  /** ¿Fue generado automáticamente desde channels[] legacy? */
  readonly autoMigrated: boolean
  /** Número total de canales DMX que este grafo produce (suma de output nodes) */
  readonly dmxFootprint: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE NODE GRAPH — El grafo completo del fixture
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgeNodeGraph {
  /** Versión del schema (para migraciones futuras) */
  readonly version: '1.0.0'
  /** Lista de nodos */
  readonly nodes: readonly IForgeNode[]
  /** Lista de conexiones entre puertos */
  readonly edges: readonly IForgeEdge[]
  /** Metadata del grafo */
  readonly meta: ForgeGraphMeta
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE DEFINITION V2 — Extensión dual-mode
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FixtureDefinitionV2: Extiende FixtureDefinition con soporte opcional de nodeGraph.
 *
 * REGLA DE PRECEDENCIA:
 * Si `nodeGraph` existe y `nodeGraph.version` es reconocida → usar nodeGraph.
 * Si `nodeGraph` no existe → usar channels[] (legacy) → generar grafo al vuelo.
 * Si ambos existen → nodeGraph tiene precedencia. channels[] se mantiene como cache/fallback.
 */
export interface FixtureDefinitionV2 extends FixtureDefinition {
  /**
   * Grafo de nodos del fixture (WAVE 4548).
   * Opcional: si ausente, se genera automáticamente desde channels[].
   * Cuando presente, es la fuente de verdad para evaluación y UI.
   */
  nodeGraph?: IForgeNodeGraph
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ForgeValidationErrorCode =
  | 'INVALID_EDGE_SOURCE'
  | 'INVALID_EDGE_TARGET'
  | 'PORT_ALREADY_CONNECTED'
  | 'CYCLE_DETECTED'
  | 'NO_OUTPUT_NODES'
  | 'DMX_OFFSET_COLLISION'
  | 'TYPE_MISMATCH'
  | 'ORPHAN_NODE'

export interface ForgeValidationError {
  readonly code: ForgeValidationErrorCode
  readonly message: string
  /** ID del nodo o edge que causó el error (si aplica) */
  readonly nodeId?: ForgeNodeId
  readonly edgeId?: ForgeEdgeId
}
