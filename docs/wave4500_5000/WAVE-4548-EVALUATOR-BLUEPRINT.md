# WAVE 4548.5 — THE ZERO-ALLOC COMPILER

> Blueprint Arquitectónico: `ForgeNodeEvaluator`
> Estado: DISEÑO | Autor: Cascade | Fecha: 2026-05-04
> Prerequisito: WAVE 4548.2 (Forge Kernel — types.ts, NodeGraphBuilder.ts)

---

## 0. PROBLEMA

El `IForgeNodeGraph` es un grafo de objetos con strings como IDs, arrays de puertos con `.find()`, y edges con lookups por nombre. Evaluar esta estructura a 44Hz × 200 fixtures = **8 800 evaluaciones/segundo** con `Map.get()`, `filter()`, y objetos efímeros destruiría el rendimiento por presión sobre el Garbage Collector de V8.

**Solución**: Compilar el grafo una vez en **Patch Time** (cuando el fixture se registra) hacia estructuras de datos planas (`Float64Array`, `Uint32Array`). En runtime, el evaluador solo itera arrays tipados con aritmética pura — **zero allocations per frame**.

---

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PATCH TIME (una vez)                        │
│                                                                     │
│  IForgeNodeGraph ──► ForgeGraphCompiler.compile() ──► CompiledGraph │
│                         │                                           │
│                         ├─ Topological Sort                         │
│                         ├─ INGENIO Inlining                         │
│                         ├─ Port → Index Mapping                     │
│                         └─ State Offset Allocation                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    FRAME TIME (44Hz hot-path)                       │
│                                                                     │
│  ArbitratedNodeMap ──► ForgeNodeEvaluator.evaluate() ──► dmxBuffer  │
│  FrameContext ──────┘     │                                         │
│                           ├─ Inject inputs (from Aether/Audio)      │
│                           ├─ Execute node functions (linear scan)   │
│                           └─ Flush outputs to Uint8Array            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. FASE A: EL COMPILADOR PRE-FRAME (Patch Time)

### 2.1 Sort Topológico (Kahn's Algorithm)

El compilador aplana el grafo de nodos en un **array de ejecución lineal** donde cada nodo se evalúa solo después de que todos sus inputs hayan sido escritos.

**Algoritmo**: Kahn's Algorithm (BFS-based topological sort) — O(V+E), zero recursion.

```
ENTRADA: IForgeNodeGraph { nodes[], edges[] }

1. Construir mapa de adyacencia:
   inDegree[nodeId] = número de edges entrantes
   adjacency[nodeId] = lista de nodeIds que dependen de este

2. Encolar todos los nodos con inDegree === 0 (nodos input_*)

3. While (queue no vacía):
   a. Dequeue nodo N
   b. Añadir N al array de ejecución (executionOrder[])
   c. Para cada successor S en adjacency[N]:
      - Decrementar inDegree[S]
      - Si inDegree[S] === 0: encolar S

4. Si executionOrder.length < nodes.length:
   → CYCLE_DETECTED (error de validación, a menos que el ciclo
     pase por un proc_delay, que lo rompe temporalmente)

SALIDA: executionOrder: ForgeNodeId[]  (orden de evaluación lineal)
```

**Manejo de ciclos con `proc_delay`**: Un `proc_delay` lee de su ring buffer interno (estado del frame anterior) y escribe al final del frame. Esto rompe la dependencia temporal. El compilador trata las edges que **entran** a un `proc_delay` como "ya resueltas" durante el sort — el `proc_delay` se puede encolar aunque su input aún no esté evaluado en este frame (usa el valor del frame N-1).

### 2.2 Aplanamiento de INGENIOS (Inlining)

Un `compound_ingenio` node contiene un `subGraph: IForgeNodeGraph` recursivo. El compilador lo "desenrolla" (**inline**) en el flujo principal:

```
1. Para cada compound_ingenio encontrado (depth-first):

   a. Leer config.subGraph y config.portMapping

   b. Prefijar todos los IDs internos del subGraph:
      nodeId  → `${ingenioNodeId}::${internalNodeId}`
      portId  → `${ingenioNodeId}::${internalPortId}`
      edgeId  → `${ingenioNodeId}::${internalEdgeId}`

   c. Inyectar los nodos internos en la lista principal de nodos

   d. Reconectar los edges externos:
      - Para cada portMapping.input:
        Redirigir el edge externo que apuntaba al INGENIO
        hacia el nodo interno correspondiente
      - Para cada portMapping.output:
        Redirigir los edges que salen del INGENIO
        desde el nodo interno correspondiente

   e. Eliminar el nodo compound_ingenio original

   f. Si el subGraph contiene más INGENIOs anidados:
      recursar (con límite de profundidad = 8)
```

**Resultado**: Después del inlining, el grafo es completamente plano — no quedan nodos `compound_ingenio`. Todos los nodos son atómicos (`input_*`, `proc_*`, `logic_*`, `output_*`).

### 2.3 Asignación de Índices de Puerto (Port → Index Mapping)

Cada puerto de cada nodo se mapea a un **índice único** en un `Float64Array` compartido llamado `wireBuffer`. Esto elimina lookups por string en runtime.

```
Port Index Allocation:

portIndex = 0
For each node in executionOrder:
  For each input port:
    inputPortIndex[nodeId][portId] = portIndex++
  For each output port:
    outputPortIndex[nodeId][portId] = portIndex++

TOTAL_WIRE_SLOTS = portIndex

wireBuffer = new Float64Array(TOTAL_WIRE_SLOTS)
```

Las **edges** se compilan como pares `(sourceIndex, targetIndex)`:

```typescript
// Cada edge se convierte en una instrucción de copia:
// wireBuffer[targetIndex] = wireBuffer[sourceIndex]
// Almacenado como Uint32Array de pares:
edgeWiring: Uint32Array  // [src0, dst0, src1, dst1, ...]
```

### 2.4 Asignación de Estado Mutable (State Offsets)

Nodos con estado interno (`proc_lfo`, `proc_delay`, `proc_smooth`, `logic_counter`) necesitan memoria persistente entre frames.

```
Estado por tipo de nodo:
┌─────────────────┬────────────────────────────┬─────────┐
│ Tipo            │ Estado                     │ Slots   │
├─────────────────┼────────────────────────────┼─────────┤
│ proc_lfo        │ phase (acumulador)         │ 1       │
│ proc_smooth     │ previousValue              │ 1       │
│ proc_delay      │ ringBuffer[delayFrames]    │ N + 1   │
│                 │ + writeHead                │ (head)  │
│ logic_counter   │ count                      │ 1       │
│ logic_threshold │ lastOutput (hysteresis)    │ 1       │
│ proc_curve      │ (stateless)                │ 0       │
│ proc_math       │ (stateless)                │ 0       │
│ proc_clamp      │ (stateless)                │ 0       │
│ proc_map_range  │ (stateless)                │ 0       │
│ proc_invert     │ (stateless)                │ 0       │
│ proc_merge      │ (stateless)                │ 0       │
│ logic_gate      │ (stateless)                │ 0       │
│ logic_switch    │ (stateless)                │ 0       │
│ logic_and       │ (stateless)                │ 0       │
│ logic_or        │ (stateless)                │ 0       │
│ input_*         │ (stateless)                │ 0       │
│ output_dmx      │ (stateless)                │ 0       │
└─────────────────┴────────────────────────────┴─────────┘
```

```
State Offset Allocation:

stateOffset = 0
For each node in executionOrder:
  nodeStateOffset[nodeId] = stateOffset
  stateOffset += stateSlots(node.type, node.config)

TOTAL_STATE_SLOTS = stateOffset

stateBuffer = new Float64Array(TOTAL_STATE_SLOTS)
```

---

## 3. FASE B: LA ESTRUCTURA DE MEMORIA ESTÁTICA

### 3.1 CompiledForgeGraph

```typescript
interface CompiledForgeGraph {
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
  /** Instrucciones a ejecutar en orden. Cada instrucción es un
   *  bloque compacto que referencia wireBuffer y stateBuffer. */
  readonly program: readonly CompiledInstruction[]

  // ── Edge Wiring (copias port→port) ──────────────────────────
  /** Uint32Array de pares [srcIdx, dstIdx]. Ejecutar ANTES del
   *  programa para propagar valores por las edges. */
  readonly edgeWiring: Uint32Array
  readonly edgeCount: number

  // ── Input Injection Map ─────────────────────────────────────
  /** channelKey → wireBuffer index. Para inyectar valores del
   *  ArbitratedNodeMap en los input_dmx nodes. */
  readonly inputMap: ReadonlyMap<string, number>

  // ── Audio Input Map ─────────────────────────────────────────
  /** band → wireBuffer index. Para inyectar energía de bandas
   *  de audio en los input_audio_band nodes. */
  readonly audioInputMap: ReadonlyMap<string, number>

  // ── Context Input Indices ───────────────────────────────────
  /** wireBuffer indices for special input nodes */
  readonly beatInputIndex: number    // -1 if not present
  readonly bpmInputIndex: number     // -1 if not present
  readonly energyInputIndex: number  // -1 if not present
  readonly timeInputIndex: number    // -1 if not present

  // ── Output Flush Map ────────────────────────────────────────
  /** Array of output descriptors, sorted by dmxOffset. */
  readonly outputs: readonly CompiledOutput[]
}

interface CompiledInstruction {
  /** Index into the function table (ForgeNodeType → eval fn). */
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
  /** Pre-extracted config values as Float64Array (max 8 params).
   *  Avoids object dereference in hot path. */
  readonly params: Float64Array
}

interface CompiledOutput {
  /** wireBuffer index where the output value lives (normalized 0-1). */
  readonly wireIndex: number
  /** DMX offset relative to device base address (0-indexed). */
  readonly dmxOffset: number
  /** Default DMX value (0-255) when wire carries no signal. */
  readonly defaultDmxValue: number
  /** Is 16-bit channel? If true, writes coarse + fine. */
  readonly is16bit: boolean
}
```

### 3.2 Mapa Visual de Memoria

```
wireBuffer (Float64Array):
┌───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│ in0.o │ in1.o │ in2.o │ p0.i  │ p0.o  │ p1.i  │ p1.o  │ out.i │ ...
│ [0]   │ [1]   │ [2]   │ [3]   │ [4]   │ [5]   │ [6]   │ [7]   │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
  ↑ inyectado     ↑ inyectado    ↑ calculado      ↑ leído para
  desde Aether    desde Aether   por programa      flush a DMX

stateBuffer (Float64Array):
┌──────────┬──────────┬──────────┬──────────┐
│ lfo.phase│ smooth.v │ delay[0] │ delay[1] │ ...
│ [0]      │ [1]      │ [2]      │ [3]      │
└──────────┴──────────┴──────────┴──────────┘
  ↑ persistente entre frames — nunca se re-alloca
```

### 3.3 Proof: Zero Allocations

| Operación | Allocations | Motivo |
|-----------|:-----------:|--------|
| `wireBuffer[i] = value` | 0 | Escritura in-place en TypedArray pre-allocated |
| `stateBuffer[i] += delta` | 0 | Mutación in-place |
| `params[j]` read | 0 | Lectura de TypedArray existente |
| `edgeWiring[k]` read | 0 | Lectura de Uint32Array existente |
| `program[n]` read | 0 | Lectura de array pre-built (readonly struct) |
| `inputMap.get(key)` | 0 | Map.get() no alloca en V8 (inline cache) |
| Iteration over `program` | 0 | `for (let i = 0; ...)` — no iterator object |
| `Math.sin()`, `Math.round()` | 0 | Primitives, no heap |
| **TOTAL per frame** | **0** | |

**Nota sobre `CompiledInstruction.params`**: Los config values (`frequencyHz`, `threshold`, etc.) se extraen del `IForgeNodeConfig` en compile time y se copian a un `Float64Array(8)` por instrucción. Esto evita cualquier dereference de objetos JS en el hot path — solo lectura de typed arrays.

---

## 4. FASE C: EL BUCLE DE EVALUACIÓN (Hot-Path)

### 4.1 Firma del Evaluador

```typescript
class ForgeNodeEvaluator {
  /**
   * Evalúa el grafo compilado de un fixture en un frame.
   *
   * ZERO-ALLOC: No crea objetos, arrays, strings ni closures.
   * Solo escribe en TypedArrays pre-allocated.
   *
   * @param compiled   — Grafo compilado (immutable después de compile)
   * @param values     — Valores arbitrados del Aether para este device
   * @param ctx        — Contexto del frame (tiempo, BPM, audio)
   * @param dmxBuffer  — Uint8Array(512) del universo destino
   * @param baseAddr   — Dirección DMX base del device (0-indexed)
   */
  static evaluate(
    compiled: CompiledForgeGraph,
    values: Readonly<Record<string, number>> | undefined,
    ctx: ForgeFrameContext,
    dmxBuffer: Uint8Array,
    baseAddr: number,
  ): void
}

interface ForgeFrameContext {
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
  /** Bandas de audio: 6 valores normalizados (0-1) */
  readonly audioBands: Float64Array  // [subBass, bass, mid, highMid, presence, air]
  /** Índice de frame (incremental, para modulaciones) */
  readonly frameIndex: number
}
```

### 4.2 Algoritmo del Hot-Path (Paso a Paso)

```
evaluate(compiled, values, ctx, dmxBuffer, baseAddr):

  wire  = compiled.wireBuffer   // alias local (V8 optimiza acceso)
  state = compiled.stateBuffer

  // ══════════════════════════════════════════════════════════════
  // PASO 1: INYECCIÓN DE INPUTS (Aether → wireBuffer)
  // ══════════════════════════════════════════════════════════════

  // 1a. Input DMX channels (desde ArbitratedNodeMap del Aether)
  if (values !== undefined) {
    for (const [channelKey, wireIdx] of compiled.inputMap) {
      const v = values[channelKey]
      wire[wireIdx] = v !== undefined ? v : 0.0
    }
  }

  // 1b. Audio bands
  if (compiled.audioInputMap.size > 0) {
    for (const [band, wireIdx] of compiled.audioInputMap) {
      wire[wireIdx] = ctx.audioBands[BAND_INDEX[band]] ?? 0.0
    }
  }

  // 1c. Special context inputs
  if (compiled.beatInputIndex >= 0)
    wire[compiled.beatInputIndex] = ctx.isBeat ? 1.0 : 0.0
  if (compiled.bpmInputIndex >= 0)
    wire[compiled.bpmInputIndex] = ctx.bpm / 300.0  // normalize to ~0-1
  if (compiled.energyInputIndex >= 0)
    wire[compiled.energyInputIndex] = ctx.energy
  if (compiled.timeInputIndex >= 0)
    wire[compiled.timeInputIndex] = (ctx.timeMs % 60000) / 60000  // 0-1 ramp per minute

  // ══════════════════════════════════════════════════════════════
  // PASO 2: PROPAGACIÓN DE EDGES (wire-to-wire copy)
  // ══════════════════════════════════════════════════════════════

  const wiring = compiled.edgeWiring
  for (let e = 0; e < compiled.edgeCount; e++) {
    const srcIdx = wiring[e * 2]
    const dstIdx = wiring[e * 2 + 1]
    wire[dstIdx] = wire[srcIdx]
  }

  // ══════════════════════════════════════════════════════════════
  // PASO 3: EJECUCIÓN DEL PROGRAMA (node functions, linear scan)
  // ══════════════════════════════════════════════════════════════

  const program = compiled.program
  for (let pc = 0; pc < program.length; pc++) {
    const instr = program[pc]
    // Dispatch por opcode a la función del nodo
    OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)
  }

  // ══════════════════════════════════════════════════════════════
  // PASO 4: FLUSH DE OUTPUTS (wireBuffer → dmxBuffer)
  // ══════════════════════════════════════════════════════════════

  const outputs = compiled.outputs
  for (let o = 0; o < outputs.length; o++) {
    const out = outputs[o]
    const normalized = wire[out.wireIndex]
    const bufIdx = baseAddr + out.dmxOffset

    if (bufIdx < 0 || bufIdx >= 512) continue  // safety

    if (out.is16bit) {
      const raw16 = Math.round(normalized * 65535)
      dmxBuffer[bufIdx]     = (raw16 >> 8) & 0xFF   // coarse (MSB)
      dmxBuffer[bufIdx + 1] = raw16 & 0xFF           // fine (LSB)
    } else {
      dmxBuffer[bufIdx] = Math.round(normalized * 255)
    }
  }
```

### 4.3 Tabla de Opcodes (Function Dispatch)

Cada `ForgeNodeType` se mapea a un `opcode` numérico. La tabla es un array de funciones, indexado por opcode — **O(1) dispatch**, sin `switch` ni `if` chains.

```typescript
type OpcodeFn = (
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  ctx: ForgeFrameContext,
) => void

const OPCODE_TABLE: readonly OpcodeFn[] = [
  op_noop,              // 0: placeholder
  op_input_dmx,         // 1: passthrough (ya inyectado en paso 1)
  op_input_audio_band,  // 2: passthrough (ya inyectado en paso 1)
  op_input_beat,        // 3: passthrough
  op_input_bpm,         // 4: passthrough
  op_input_energy,      // 5: passthrough
  op_input_constant,    // 6: wire[out] = params[0]
  op_input_time,        // 7: passthrough
  op_proc_lfo,          // 8: LFO oscillator
  op_proc_smooth,       // 9: exponential smoothing
  op_proc_map_range,    // 10: linear re-map
  op_proc_math,         // 11: arithmetic op
  op_proc_clamp,        // 12: clamp [min, max]
  op_proc_delay,        // 13: ring buffer delay
  op_proc_merge,        // 14: multi-input merge
  op_proc_invert,       // 15: 1.0 - input
  op_proc_curve,        // 16: transfer curve
  op_logic_threshold,   // 17: threshold with hysteresis
  op_logic_gate,        // 18: signal gate
  op_logic_switch,      // 19: A/B selector
  op_logic_and,         // 20: boolean AND
  op_logic_or,          // 21: boolean OR
  op_logic_counter,     // 22: modulo counter
  op_output_dmx,        // 23: passthrough (flush en paso 4)
]
```

### 4.4 Ejemplos de Funciones de Nodo

```typescript
// ── LFO: Oscilador con estado persistente ────────────────────
function op_proc_lfo(
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  ctx: ForgeFrameContext,
): void {
  // params layout: [waveform, frequencyHz, syncToBpm, bpmDivisor, phase]
  const waveform    = instr.params[0]  // enum as number
  const frequencyHz = instr.params[1]
  const syncToBpm   = instr.params[2]  // 0.0 or 1.0
  const bpmDivisor  = instr.params[3]
  const initPhase   = instr.params[4]

  // Calcular frecuencia efectiva
  let freq = frequencyHz
  if (syncToBpm > 0.5 && ctx.bpm > 0) {
    freq = (ctx.bpm / 60.0) / bpmDivisor
  }

  // Leer y actualizar fase desde stateBuffer
  const phaseIdx = instr.stateOffset
  let phase = state[phaseIdx]
  phase += freq * (ctx.deltaMs / 1000.0)
  phase = phase % 1.0  // wrap [0, 1)
  state[phaseIdx] = phase

  // Calcular valor según waveform
  const t = (phase + initPhase) % 1.0
  let value: number
  switch (waveform) {
    case 0: value = 0.5 + 0.5 * Math.sin(t * 6.283185307); break // sine
    case 1: value = t < 0.5 ? t * 2.0 : 2.0 - t * 2.0; break    // triangle
    case 2: value = t; break                                       // sawtooth
    case 3: value = t < 0.5 ? 1.0 : 0.0; break                    // square
    default: value = state[phaseIdx + 1] ?? 0; break               // random_hold (future)
  }

  // Input modulation: si hay un input conectado, modula la amplitud
  const inputVal = wire[instr.inputOffset]
  wire[instr.outputOffset] = value * (inputVal > 0 ? inputVal : 1.0)
}

// ── Smooth: Suavizado exponencial ────────────────────────────
function op_proc_smooth(
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  ctx: ForgeFrameContext,
): void {
  // params: [attackMs, releaseMs]
  const attackMs  = instr.params[0]
  const releaseMs = instr.params[1]

  const input    = wire[instr.inputOffset]
  const prevIdx  = instr.stateOffset
  const previous = state[prevIdx]

  // Coeficiente exponencial: 1 - e^(-dt/tau)
  const dt = ctx.deltaMs
  const tau = input > previous ? attackMs : releaseMs
  const alpha = tau > 0 ? 1.0 - Math.exp(-dt / tau) : 1.0

  const smoothed = previous + alpha * (input - previous)
  state[prevIdx] = smoothed
  wire[instr.outputOffset] = smoothed
}

// ── Delay: Ring buffer ───────────────────────────────────────
function op_proc_delay(
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  _ctx: ForgeFrameContext,
): void {
  // params: [delayFrames]
  const delayFrames = instr.params[0] | 0  // integer
  const bufStart    = instr.stateOffset
  const headIdx     = bufStart + delayFrames  // last slot = write head

  const head = state[headIdx] | 0
  const readPos = (head - delayFrames + delayFrames * 2) % delayFrames

  // Output = oldest sample
  wire[instr.outputOffset] = state[bufStart + readPos]

  // Write new sample
  state[bufStart + head] = wire[instr.inputOffset]

  // Advance head
  state[headIdx] = (head + 1) % delayFrames
}

// ── Threshold: Con histéresis ────────────────────────────────
function op_logic_threshold(
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  _ctx: ForgeFrameContext,
): void {
  // params: [threshold, hysteresis]
  const threshold  = instr.params[0]
  const hysteresis = instr.params[1]
  const input      = wire[instr.inputOffset]
  const prevOutput = state[instr.stateOffset]

  let output: number
  if (prevOutput > 0.5) {
    // Currently ON — turn OFF only below (threshold - hysteresis)
    output = input >= (threshold - hysteresis) ? 1.0 : 0.0
  } else {
    // Currently OFF — turn ON only above (threshold + hysteresis)
    output = input > (threshold + hysteresis) ? 1.0 : 0.0
  }

  state[instr.stateOffset] = output
  wire[instr.outputOffset] = output
}
```

---

## 5. FASE D: INTEGRACIÓN CON NODRESOLVER

### 5.1 Detección de Grafo Compilado

El `NodeResolver` actualmente opera sobre `ICapabilityNode[]` desde el `INodeGraph` (Aether). Para integrar el `ForgeNodeEvaluator`, necesitamos un **desvío condicional** por device.

```typescript
// En NodeResolver._writeNode():

private _writeNode(
  nodeId: NodeId,
  channelValues: Readonly<Record<string, number>>,
): void {
  const node = this._graph.getNodeData(nodeId)
  if (!node) return

  const device = this._graph.getDevice(node.deviceId)
  if (!device) return

  // ═══ WAVE 4548.5: FORGE EVALUATOR BYPASS ═══
  // Si este device tiene un grafo Forge compilado,
  // delegar COMPLETAMENTE al ForgeNodeEvaluator.
  // El evaluador produce DMX directamente — no pasar
  // por el flujo legacy de channels/calibration/curves.
  const compiled = this._forgeGraphs.get(node.deviceId)
  if (compiled) {
    ForgeNodeEvaluator.evaluate(
      compiled,
      channelValues,       // ArbitratedNodeMap values for this node
      this._frameContext,   // ForgeFrameContext (injected pre-resolve)
      this._universeBuffers.get(device.universe)!,
      device.dmxAddress - 1,  // 0-indexed
    )
    this._activeUniverses.add(device.universe)
    return  // ← BYPASS: no ejecutar flujo legacy
  }

  // ── Legacy flow (unchanged) ──────────────────
  // ... existing code ...
}
```

### 5.2 Registro de Grafos Compilados

```typescript
// Nuevos miembros en NodeResolver:

class NodeResolver {
  // ── WAVE 4548.5: Forge compiled graphs por device ──────────
  private readonly _forgeGraphs = new Map<DeviceId, CompiledForgeGraph>()
  private _frameContext: ForgeFrameContext = DEFAULT_FRAME_CONTEXT

  /**
   * Registra un grafo Forge compilado para un device.
   * PATCH TIME — llamar cuando se registra un Device que tiene
   * FixtureDefinitionV2.nodeGraph.
   *
   * Cuando presente, el Forge evaluator REEMPLAZA el flujo legacy
   * de channel iteration + TransferCurve + calibration para ese device.
   */
  registerForgeGraph(deviceId: DeviceId, compiled: CompiledForgeGraph): void {
    this._forgeGraphs.set(deviceId, compiled)
  }

  unregisterForgeGraph(deviceId: DeviceId): void {
    this._forgeGraphs.delete(deviceId)
  }

  /**
   * Inyectar contexto de frame antes de resolve().
   * Llamar desde el Orchestrator junto con setResolveContext().
   */
  setForgeFrameContext(ctx: ForgeFrameContext): void {
    this._frameContext = ctx
  }
}
```

### 5.3 Pipeline Completo en el TitanOrchestrator

```
Frame Tick (44Hz):
  │
  ├─ 1. AudioWorker → engineAudioMetrics (bpm, bands, energy, isBeat)
  │
  ├─ 2. Adapters emit INodeIntents to IntentBus
  │     (LiquidImpact, VMM, Color, Beam, Atmosphere)
  │
  ├─ 3. NodeArbiter → ArbitratedNodeMap
  │
  ├─ 4. NodeResolver.setResolveContext(bpm, confidence)
  │     NodeResolver.setForgeFrameContext({       ← NEW
  │       timeMs, deltaMs, bpm, bpmConfidence,
  │       isBeat, energy, audioBands, frameIndex,
  │     })
  │
  ├─ 5. NodeResolver.resolve(arbitrated)
  │     │
  │     ├─ Per node:
  │     │   ├─ Has compiled ForgeGraph? → ForgeNodeEvaluator.evaluate()
  │     │   │   (inputs → program → DMX flush — all in TypedArrays)
  │     │   │
  │     │   └─ No ForgeGraph? → Legacy flow
  │     │       (TransferCurve → calibration → DMX)
  │     │
  │     └─ Emit Uint8Array(512) per universe
  │
  └─ 6. HAL.sendUniverseRaw(universe, buffer)  ← zero-copy
```

### 5.4 Backward Compatibility Guarantee

| Escenario | Comportamiento |
|-----------|---------------|
| Fixture con `nodeGraph` (auto-migrado desde `channels[]`) | Compila grafo passthrough. Resultado DMX **idéntico** al legacy (input→output directo, sin proceso intermedio). |
| Fixture con `nodeGraph` enriquecido (LFOs, math, etc.) | Compila grafo completo. ForgeNodeEvaluator produce DMX. Legacy flow nunca se ejecuta. |
| Fixture SIN `nodeGraph` (JSON antiguo no hidratado) | No se compila nada. Legacy flow intacto. Zero impacto. |
| Fixture con `nodeGraph` corrupto / no compilable | Log error en patch time. Fallback a legacy flow. |

---

## 6. PERFORMANCE BUDGET

### 6.1 Estimación de Latencia

```
Fixture típico: 12 channels → 12 input + 12 output + 0 proc = 24 nodos
Wire slots: ~48 (24 nodos × 2 ports avg)
Edge wiring: 12 copies (12 edges × 2 reads = 24 Float64 reads)
Program execution: 24 opcodes × ~20ns each = ~480ns
DMX flush: 12 outputs × ~10ns each = ~120ns

TOTAL PER FIXTURE: ~700ns (0.7 μs)

200 fixtures: 200 × 0.7μs = 140μs = 0.14ms

Budget at 44Hz: 22.7ms per frame
Forge evaluation: 0.14ms / 22.7ms = 0.6% of frame budget ✅

Fixture complejo con LFOs/math: ~50 nodos → ~1.5μs
200 complejos: 300μs = 0.3ms = 1.3% of frame budget ✅
```

### 6.2 Memory Budget

```
Per fixture (12ch passthrough):
  wireBuffer:  48 × 8 bytes  = 384 bytes
  stateBuffer: 0 bytes (stateless passthrough)
  program:     24 instructions × ~80 bytes = 1920 bytes
  edgeWiring:  12 × 8 bytes  = 96 bytes
  TOTAL: ~2.4 KB

Per fixture (50-node complex with 5 LFOs):
  wireBuffer:  120 × 8 bytes = 960 bytes
  stateBuffer: 10 × 8 bytes  = 80 bytes
  program:     50 × ~80 bytes = 4000 bytes
  edgeWiring:  60 × 8 bytes  = 480 bytes
  TOTAL: ~5.5 KB

200 fixtures: 200 × 5.5KB = 1.1 MB  ✅ (negligible)
```

---

## 7. RESUMEN DE INTERFACES TypeScript (FIRMAS)

```typescript
// ── Compiler (Patch Time) ─────────────────────────────────────
class ForgeGraphCompiler {
  static compile(
    graph: IForgeNodeGraph,
    fixtureId: string,
  ): CompiledForgeGraph

  // Internals
  private static _topologicalSort(graph: IForgeNodeGraph): ForgeNodeId[]
  private static _inlineIngenios(graph: IForgeNodeGraph): IForgeNodeGraph
  private static _allocateWires(
    executionOrder: ForgeNodeId[],
    graph: IForgeNodeGraph,
  ): { wireBuffer: Float64Array; portIndexMap: Map<string, number> }
  private static _allocateState(
    executionOrder: ForgeNodeId[],
    graph: IForgeNodeGraph,
  ): { stateBuffer: Float64Array; stateOffsetMap: Map<string, number> }
  private static _buildProgram(
    executionOrder: ForgeNodeId[],
    graph: IForgeNodeGraph,
    portIndexMap: Map<string, number>,
    stateOffsetMap: Map<string, number>,
  ): CompiledInstruction[]
  private static _buildEdgeWiring(
    graph: IForgeNodeGraph,
    portIndexMap: Map<string, number>,
  ): Uint32Array
}

// ── Evaluator (Hot-Path) ──────────────────────────────────────
class ForgeNodeEvaluator {
  static evaluate(
    compiled: CompiledForgeGraph,
    values: Readonly<Record<string, number>> | undefined,
    ctx: ForgeFrameContext,
    dmxBuffer: Uint8Array,
    baseAddr: number,
  ): void
}

// ── Integration (NodeResolver extension) ──────────────────────
// NodeResolver gains:
//   registerForgeGraph(deviceId, compiled): void
//   unregisterForgeGraph(deviceId): void
//   setForgeFrameContext(ctx): void
```

---

## 8. ARCHIVOS A CREAR EN IMPLEMENTACIÓN

| Archivo | Contenido | Phase |
|---------|-----------|-------|
| `src/core/forge/compiler/ForgeGraphCompiler.ts` | Topological sort, inlining, wire/state allocation, program build | N4a |
| `src/core/forge/compiler/types.ts` | `CompiledForgeGraph`, `CompiledInstruction`, `CompiledOutput`, `ForgeFrameContext` | N4a |
| `src/core/forge/evaluator/ForgeNodeEvaluator.ts` | Static `evaluate()` + opcode table | N4b |
| `src/core/forge/evaluator/opcodes.ts` | Individual opcode functions (one per ForgeNodeType) | N4b |
| Modify: `src/core/aether/resolver/NodeResolver.ts` | Add `_forgeGraphs`, bypass in `_writeNode()` | N4c |
| Modify: `src/core/orchestrator/TitanOrchestrator.ts` | Inject `ForgeFrameContext`, compile on device register | N4c |

---

*Blueprint WAVE 4548.5 — The Zero-Alloc Compiler. Diseño puro, cero código de producción.*
