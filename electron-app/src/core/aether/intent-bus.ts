/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — INTENT BUS CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: El bus de alta velocidad — cero allocations.
 *
 * El IntentBus es el canal de comunicación entre los 5 Systems y
 * el NodeArbiter. Los Systems escriben NodeIntents en el bus;
 * el Arbiter los lee y resuelve conflictos multicapa.
 *
 * DISEÑO ZERO-ALLOC:
 * El bus es un array pre-allocated de MAX_INTENTS_PER_FRAME slots.
 * `clear()` resetea el write pointer a 0 sin desalocar.
 * `push()` escribe en la siguiente posición.
 * `getIntentsForNode()` usa un índice auxiliar reconstruido in-place.
 *
 * Costo de un frame: 0 allocations, 0 GC pressure.
 * Solo escrituras en arrays pre-existentes.
 *
 * @module core/aether/intent-bus
 * @version WAVE 3505.1
 */

import type {
  NodeId,
  IntentSource,
  MergeStrategy,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// NODE INTENT — Unidad atómica de deseo sobre un nodo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 INodeIntent — Un deseo concreto sobre un nodo de capacidad.
 *
 * Producido por un System o Hook. Consumido por el NodeArbiter.
 *
 * Cada intent dice: "Yo (fuente X) quiero que el nodo Y tenga
 * estos valores en sus canales, con esta prioridad y confianza."
 *
 * Múltiples intents pueden apuntar al mismo nodo en el mismo frame
 * (e.g. ColorSystem + Selene IA ambos quieren controlar un COLOR_NODE).
 * El NodeArbiter resuelve el conflicto usando la estrategia de merge
 * del canal y las prioridades de las capas.
 *
 * VALORES NORMALIZADOS:
 * Todos los valores en `values` están en rango **0-1** (normalizado).
 * La conversión a rango DMX (0-255) es responsabilidad exclusiva
 * del NodeResolver, que aplica la TransferCurve del nodo antes
 * de escalar.
 *
 * @see WAVE-3505-BLUEPRINT.md §3.1 "NODE INTENTS (Output de los Systems)"
 */
export interface INodeIntent {
  /** ID del nodo objetivo */
  readonly nodeId: NodeId
  /**
   * Valores deseados por canal (channel type → valor normalizado 0-1).
   *
   * Solo incluye los canales que este intent quiere controlar.
   * Canales no presentes = "no tengo opinión" (pass-through).
   *
   * Ejemplo para un COLOR_NODE:
   * ```ts
   * { red: 0.8, green: 0.2, blue: 0.6 }
   * ```
   *
   * Ejemplo para un IMPACT_NODE:
   * ```ts
   * { dimmer: 0.95, shutter: 1.0 }
   * ```
   */
  readonly values: Readonly<Record<string, number>>
  /**
   * Prioridad numérica de este intent.
   *
   * Usada por el NodeArbiter para resolver conflictos cuando
   * dos intents de la misma capa apuntan al mismo canal.
   * Mayor número = mayor prioridad.
   *
   * Rangos convencionales:
   * - 0-99:    Systems base (L0)
   * - 100-199: Selene IA (L1)
   * - 200-299: Manual overrides (L2)
   * - 300-399: Effects (L3)
   * - 900+:    Blackout / emergency (L4)
   */
  readonly priority: number
  /**
   * Confianza del System en este intent (0-1).
   *
   * Usada para blending suave entre intents conflictivos.
   * Un System con confidence=0.3 "sugiere"; uno con confidence=1.0
   * "exige". El Arbiter puede usar este valor para weighted merge.
   *
   * Ejemplo: Selene IA puede tener confidence=0.7 en un hue shift,
   * permitiendo que el 30% del color base se conserve.
   */
  readonly confidence: number
  /** Identifica qué System o Hook produjo este intent */
  readonly source: IntentSource
}

// ═══════════════════════════════════════════════════════════════════════════
// AGGREGATED & ARBITRATED MAPS — Tipos de colección
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa agregado: nodeId → lista de todos los intents para ese nodo.
 *
 * Producido por el IntentBus cuando el Arbiter drena el frame.
 * Puede contener múltiples intents por nodo (de distintos Systems/Hooks).
 */
export type AggregatedNodeIntentMap = ReadonlyMap<NodeId, readonly INodeIntent[]>

/**
 * Mapa arbitrado: nodeId → valores finales por canal.
 *
 * Producido por el NodeArbiter tras resolver todos los conflictos
 * de merge multicapa. Cada canal tiene exactamente un valor final
 * normalizado (0-1).
 *
 * Consumido por el NodeResolver para generar DMXPackets.
 */
export type ArbitratedNodeMap = ReadonlyMap<NodeId, Readonly<Record<string, number>>>

// ═══════════════════════════════════════════════════════════════════════════
// DMX PACKET — Output final para el driver de hardware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Paquete DMX listo para enviar al driver de hardware.
 *
 * Producido por el NodeResolver. Contiene todos los canales
 * de un Device en su rango DMX, ordenados por offset.
 *
 * El HAL consume estos paquetes sin necesidad de conocer
 * la estructura de nodos — solo ve bytes DMX.
 */
export interface IDMXPacket {
  /** Universo DMX (1-based) */
  readonly universe: number
  /** Dirección DMX base del Device (1-512) */
  readonly address: number
  /**
   * Valores DMX de los canales (0-255 cada uno).
   * Indexados por offset relativo a `address`.
   * `channels[0]` = valor en `address`, `channels[1]` = `address+1`, etc.
   */
  readonly channels: readonly number[]
}

// ═══════════════════════════════════════════════════════════════════════════
// IINTENTBUS — El contrato del bus de alta velocidad
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🚀 IIntentBus — Canal de comunicación zero-alloc entre Systems y Arbiter.
 *
 * PROTOCOLO DE USO POR FRAME:
 * ```
 * 1. Orchestrator llama bus.clear()           ← reset write pointer
 * 2. ColorSystem   llama bus.push(intent)     ← escribe intents
 * 3. ImpactSystem  llama bus.push(intent)     ← escribe intents
 * 4. KineticSystem llama bus.push(intent)     ← escribe intents
 * 5. BeamSystem    llama bus.push(intent)     ← escribe intents
 * 6. AtmosSystem   llama bus.push(intent)     ← escribe intents
 * 7. Arbiter lee bus.getIntentsForNode(id)    ← drena por nodo
 * ```
 *
 * GARANTÍAS:
 * - clear() es O(1) — solo mueve un puntero
 * - push() es O(1) amortizado
 * - getIntentsForNode() es O(k) donde k = intents para ese nodo
 * - 0 allocations en todo el ciclo (pre-allocated)
 * - Thread-safe bajo el modelo single-writer (un System a la vez)
 *
 * CAPACIDAD:
 * Pre-allocated con MAX_INTENTS_PER_FRAME slots (recomendado: 2048).
 * Si se excede la capacidad, los intents adicionales se descartan
 * y se registra un warning en telemetría.
 *
 * @see WAVE-3505-BLUEPRINT.md §4.2 "Comunicación eficiente: el IntentBus"
 */
export interface IIntentBus {
  /**
   * Resetea el bus al inicio del frame.
   *
   * Zero-alloc: solo mueve el write pointer a 0.
   * No desaloca ni reinicializa el array subyacente.
   * Todos los intents del frame anterior quedan invalidados.
   */
  clear(): void

  /**
   * Escribe un intent en el bus.
   *
   * Llamado por los Systems durante su fase `process()`.
   * El intent se almacena en el slot indicado por el write pointer
   * y el pointer avanza.
   *
   * @param intent — El intent a escribir
   * @returns true si se escribió, false si el bus está lleno
   */
  push(intent: INodeIntent): boolean

  /**
   * Lee todos los intents dirigidos a un nodo específico.
   *
   * Llamado por el NodeArbiter durante `arbitrate()`.
   * Usa un índice auxiliar (nodeId → slot range) que se
   * reconstruye in-place al finalizar la fase de push.
   *
   * @param nodeId — ID del nodo cuyos intents queremos leer
   * @returns Array (potencialmente vacío) de intents para ese nodo
   */
  getIntentsForNode(nodeId: NodeId): readonly INodeIntent[]

  /**
   * Lee todos los intents del frame actual.
   * Solo para debug y telemetría — no usar en el hot path.
   */
  getAll(): readonly INodeIntent[]

  /**
   * WAVE 4663 — Accede a un intent por índice sin allocar.
   * Para usar en hot-path en lugar de getAll().
   * Solo válido para índices 0 <= i < count.
   */
  getAt(index: number): INodeIntent

  /** Número de intents escritos en el frame actual */
  readonly count: number

  /** Capacidad máxima del bus (pre-allocated) */
  readonly capacity: number

  /**
   * ¿Se descartaron intents en el frame actual por overflow?
   * Si true, la telemetría debería alertar de capacidad insuficiente.
   */
  readonly overflowed: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// INODEARBITER — Contrato del árbitro de nodos multicapa
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚖️ INodeArbiter — Composición multicapa sobre nodos de capacidad.
 *
 * El NodeArbiter es el equivalente V2 del ArbitrationDirector,
 * pero opera sobre nodos en lugar de fixtures. Recibe intents
 * de múltiples capas y resuelve conflictos por canal usando
 * las estrategias de merge (HTP, LTP, ADD).
 *
 * CAPAS DE PRIORIDAD (menor a mayor):
 * - L0: System intents    (ColorSystem, ImpactSystem, etc.)
 * - L1: Selene IA         (overrides de consciencia)
 * - L2: Manual overrides  (UI faders, MIDI, OSC)
 * - L3: Effects           (LiveFXEngine)
 * - L4: Blackout          (emergencia — siempre gana)
 * - LP: Playback          (Chronos Timeline — prioridad configurable)
 *
 * MERGE PER-CHANNEL:
 * Para cada canal de cada nodo, el arbiter selecciona la estrategia:
 * - `dimmer` → HTP (el valor más alto gana)
 * - `red/green/blue/pan/tilt/...` → LTP (la capa más alta gana)
 * - Efectos aditivos → ADD (suma clamped)
 *
 * @see WAVE-3505-BLUEPRINT.md §4 "El NodeArbiter"
 */
export interface INodeArbiter {
  /**
   * Inyecta los intents de los 5 Systems (capa L0).
   * El arbiter drena el bus durante `arbitrate()`.
   */
  setSystemIntents(bus: IIntentBus): void

  /**
   * Inyecta overrides de Selene IA (capa L1).
   * @param intents — Intents producidos por ISeleneNodeBridge
   */
  setSeleneOverrides(intents: readonly INodeIntent[]): void

  /**
   * Establece un override manual sobre un nodo (capa L2).
   * Solo los canales especificados en `channels` se overridean;
   * los demás pasan through a capas inferiores.
   *
   * @param nodeId — ID del nodo a overridear
   * @param channels — Mapa de canal → valor normalizado (0-1)
   */
  setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void

  /**
   * Libera el override manual sobre un nodo.
   * Los canales previamente overrideados vuelven a la capa L0/L1.
   *
   * @param nodeId — ID del nodo a liberar
   */
  clearManualOverride(nodeId: NodeId): void

  /**
   * Inyecta intents de efectos (capa L3).
   * @param intents — Intents producidos por ILiveFXEngine
   */
  setEffectIntents(intents: readonly INodeIntent[]): void

  /**
   * Inyecta intents de Hephaestus custom clips (capa L3+, Diamond Data).
   * @param intents — Intents producidos por HephaestusAetherAdapter
   */
  setHephaestusIntents(intents: readonly INodeIntent[]): void

  /**
   * Inyecta intents de playback (capa LP, Chronos Timeline).
   * @param intents — Intents producidos por IChronosNodeBridge
   */
  setPlaybackIntents(intents: readonly INodeIntent[]): void

  /**
   * Activa o desactiva blackout global (capa L4).
   * Cuando activo, TODOS los nodos emiten su `defaultValue`
   * (típicamente 0 para dimmers, 0 para colores).
   *
   * @param active — true = blackout, false = operación normal
   */
  setBlackout(active: boolean): void

  /**
   * Ejecuta el arbitraje para el frame actual.
   *
   * Pipeline interno:
   * 1. Recolectar candidatos de todas las capas para cada nodo.
   * 2. Para cada canal de cada nodo, aplicar la estrategia de merge.
   * 3. Aplicar Grand Master sobre canales de intensidad.
   * 4. Producir el ArbitratedNodeMap.
   *
   * @returns Mapa de nodeId → valores finales por canal (normalizados 0-1)
   */
  arbitrate(): ArbitratedNodeMap

  /**
   * Establece el Grand Master global (0-1).
   *
   * Multiplica TODOS los canales de intensidad (dimmer, shutter)
   * de TODOS los nodos tras el merge de capas.
   * 0 = oscuridad total, 1 = sin atenuación.
   */
  setGrandMaster(value: number): void
}

// ═══════════════════════════════════════════════════════════════════════════
// INODERESOLVER — Contrato de traducción nodo → DMX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔌 INodeResolver — Traduce nodos abstractos a paquetes DMX físicos.
 *
 * Es el último paso antes del hardware. Toma el ArbitratedNodeMap
 * (valores normalizados 0-1) y produce DMXPackets listos para
 * enviar al driver.
 *
 * PIPELINE INTERNO:
 * 1. Reagrupar nodos por deviceId
 * 2. Para cada nodo: aplicar TransferCurve, escalar a DMX (0-255)
 * 3. Aplicar constraints (maxValue, 16-bit split)
 * 4. Ensamblar DMXPacket por Device (address + channels)
 * 5. Aplicar calibration offsets (invertPan, tiltLimits, etc.)
 *
 * NO conoce la existencia de TitanEngine, Selene, ni del Arbiter
 * legacy. Solo ve nodos y valores.
 *
 * @see WAVE-3505-BLUEPRINT.md §5 "El NodeResolver"
 */
export interface INodeResolver {
  /**
   * Resuelve nodos abstractos a paquetes DMX físicos.
   *
   * @param arbitrated — Mapa de valores arbitrados por nodo (0-1)
   * @returns Paquetes DMX ordenados por (universe, address)
   */
  resolve(arbitrated: ArbitratedNodeMap): readonly IDMXPacket[]
}
