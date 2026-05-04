/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE COMPILER — COMPILED GRAPH TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4a): Estructuras planas pre-allocated para evaluación
 * zero-alloc a 44Hz. Generadas en Patch Time por ForgeGraphCompiler.
 *
 * INVARIANTE: Nada en este archivo se instancia durante el hot-path.
 * Todo se construye UNA VEZ en compile() y se reutiliza frame a frame.
 *
 * @module core/forge/compiler/types
 * @version WAVE 4548.6
 */

// ═══════════════════════════════════════════════════════════════════════════
// COMPILED INSTRUCTION — Instrucción atómica del programa
// ═══════════════════════════════════════════════════════════════════════════

export interface CompiledInstruction {
  /** Index into the OPCODE_TABLE (ForgeNodeType → eval fn). */
  readonly opcode: number
  /** Offset into wireBuffer for this node's FIRST input port. */
  readonly inputOffset: number
  /** Number of input ports. */
  readonly inputCount: number
  /** Offset into wireBuffer for this node's FIRST output port. */
  readonly outputOffset: number
  /** Number of output ports. */
  readonly outputCount: number
  /** Offset into stateBuffer for this node's persistent state. */
  readonly stateOffset: number
  /** Number of state slots. */
  readonly stateSlots: number
  /**
   * Pre-extracted config values as Float64Array (max 8 params).
   * Avoids object dereference in hot path — pure typed array reads.
   */
  readonly params: Float64Array
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILED OUTPUT — Descriptor de salida DMX
// ═══════════════════════════════════════════════════════════════════════════

export interface CompiledOutput {
  /** wireBuffer index where the output value lives (normalized 0-1). */
  readonly wireIndex: number
  /** DMX offset relative to device base address (0-indexed). */
  readonly dmxOffset: number
  /** Default DMX value (0-255) when wire carries no signal. */
  readonly defaultDmxValue: number
  /** Is 16-bit channel? If true, writes coarse + fine. */
  readonly is16bit: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILED FORGE GRAPH — La estructura completa compilada
// ═══════════════════════════════════════════════════════════════════════════

export interface CompiledForgeGraph {
  // ── Identidad ───────────────────────────────────────────────
  /** ID del fixture al que pertenece este grafo compilado */
  readonly fixtureId: string

  // ── Wire Buffer (conexiones entre puertos) ──────────────────
  /** Float64Array pre-allocated. Cada slot = valor de un puerto. */
  readonly wireBuffer: Float64Array
  /** Número total de slots de wire */
  readonly totalWireSlots: number

  // ── State Buffer (memoria persistente entre frames) ─────────
  /** Float64Array pre-allocated. Estado mutable de nodos stateful. */
  readonly stateBuffer: Float64Array
  /** Número total de slots de estado */
  readonly totalStateSlots: number

  // ── Execution Program (instrucciones lineales) ──────────────
  /** Instrucciones a ejecutar en orden topológico. */
  readonly program: readonly CompiledInstruction[]

  // ── Edge Wiring (copias port→port) ──────────────────────────
  /** Uint32Array de pares [srcIdx, dstIdx]. */
  readonly edgeWiring: Uint32Array
  readonly edgeCount: number

  // ── Input Injection Map ─────────────────────────────────────
  /** channelKey → wireBuffer index. Para inyectar valores del
   *  ArbitratedNodeMap en los input_dmx nodes. */
  readonly inputMap: ReadonlyMap<string, number>

  // ── Audio Input Map ─────────────────────────────────────────
  /** band → wireBuffer index. Para inyectar energía de bandas. */
  readonly audioInputMap: ReadonlyMap<string, number>

  // ── Context Input Indices ───────────────────────────────────
  /** wireBuffer indices for special input nodes (-1 if not present) */
  readonly beatInputIndex: number
  readonly bpmInputIndex: number
  readonly energyInputIndex: number
  readonly timeInputIndex: number

  // ── Output Flush Map ────────────────────────────────────────
  /** Array of output descriptors, sorted by dmxOffset. */
  readonly outputs: readonly CompiledOutput[]
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE FRAME CONTEXT — Contexto por frame para el evaluador
// ═══════════════════════════════════════════════════════════════════════════

export interface ForgeFrameContext {
  /** Tiempo del frame actual (ms, monotónico) */
  readonly timeMs: number
  /** Delta time desde el frame anterior (ms) */
  readonly deltaMs: number
  /** BPM actual (del AudioWorker) */
  readonly bpm: number
  /** Confianza del BPM (0-1) */
  readonly bpmConfidence: number
  /** ¿Hubo un beat en este frame? (true = pulso) */
  readonly isBeat: boolean
  /** Energía RMS global normalizada (0-1) */
  readonly energy: number
  /** Bandas de audio: 6 valores normalizados (0-1)
   *  [subBass, bass, mid, highMid, presence, air] */
  readonly audioBands: Float64Array
  /** Índice de frame (incremental, para modulaciones) */
  readonly frameIndex: number
}

/**
 * Mutable version of ForgeFrameContext for internal use by the Orchestrator.
 * Fields are mutated in-place each frame (zero-alloc). Exposed externally
 * as the readonly ForgeFrameContext via type widening.
 */
export interface MutableForgeFrameContext {
  timeMs: number
  deltaMs: number
  bpm: number
  bpmConfidence: number
  isBeat: boolean
  energy: number
  audioBands: Float64Array
  frameIndex: number
}

/** Default ForgeFrameContext for initialization (all zeros). */
export const DEFAULT_FORGE_FRAME_CONTEXT: ForgeFrameContext = {
  timeMs: 0,
  deltaMs: 22.7,
  bpm: 120,
  bpmConfidence: 0,
  isBeat: false,
  energy: 0,
  audioBands: new Float64Array(6),
  frameIndex: 0,
}
