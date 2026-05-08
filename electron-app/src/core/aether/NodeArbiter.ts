/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚖️  AETHER MATRIX — NODE ARBITER (IMPLEMENTACIÓN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.4: Implementación concreta del INodeArbiter.
 *
 * El NodeArbiter resuelve conflictos multicapa sobre los CapabilityNodes.
 * Opera sobre valores normalizados (0-1) producidos por los 5 Systems
 * y los hooks externos (Selene, Manual, Effects, Playback).
 *
 * ESTRATEGIAS DE MERGE POR CANAL:
 * - `dimmer`, `strobe`, `shutter` → HTP (Highest Takes Precedence)
 * - todos los demás → LTP (Latest Takes Precedence = capa de mayor prioridad)
 *
 * CAPAS (menor a mayor prioridad):
 * - L0: IntentBus (Systems — ColorSystem, ImpactSystem, KineticSystem…)
 * - L1: Selene IA overrides
 * - L2: Manual overrides (MIDI, OSC, UI faders)
 * - L3: Effect intents (LiveFXEngine)
 * - LP: Playback intents (Chronos Timeline)
 * - L4: Blackout (state flag; el gate final se aplica en egress)
 *
 * ZERO-ALLOC EN HOT PATH:
 * - `_result` es un Map pre-existente que se muta in-place cada frame.
 * - Los Records internos se reusan vía `_resultPool` (object pool).
 * - No se crean nuevos Maps, Sets ni Arrays durante `arbitrate()`.
 *
 * @module core/aether/NodeArbiter
 * @version WAVE 3505.4
 */

import type {
  NodeId,
} from './types'
import type {
  INodeArbiter,
  INodeIntent,
  IIntentBus,
  ArbitratedNodeMap,
} from './intent-bus'

// ── Canales con estrategia HTP ──────────────────────────────────────────
// Solo los canales de intensidad aplican HTP.
// El resto usa LTP (la capa más alta dicta el valor final).
const HTP_CHANNELS = new Set<string>(['dimmer', 'strobe', 'shutter'])
const MOVER_SHIELD_BLOCKED_CHANNELS = new Set<string>([
  'r', 'g', 'b',
  'red', 'green', 'blue',
  'white', 'amber',
])
const PHOTON_TRACER_EVERY_FRAMES = 20

/**
 * NodeArbiter — Implementación zero-alloc del árbitro multicapa.
 */
export class NodeArbiter implements INodeArbiter {

  // ── Estado por frame ──────────────────────────────────────────────────

  /** Bus de intents de los Systems (L0) */
  private _systemBus: IIntentBus | null = null

  /** Overrides Selene IA (L1) — array legacy */
  private _seleneOverrides: readonly INodeIntent[] = []

  /**
   * WAVE 4663 — Bus dedicado de Selene (L1).
   * Se actualiza cada frame por TitanOrchestrator antes de arbitrate().
   * Cuando count === 0 (Silence Rule), la capa L1 es un no-op completo
   * y la capa L0 (Liquid/VMM) retoma el control instantáneamente.
   */
  private _seleneBus: IIntentBus | null = null

  /** Manual overrides (L2): nodeId → { channel: value } */
  private readonly _manualOverrides = new Map<NodeId, Readonly<Record<string, number>>>()

  /** WAVE 4670: Mapa de nodos COLOR protegidos por Mover Shield en L1 */
  private readonly _moverShieldNodeIds = new Set<NodeId>()

  /**
   * WAVE 4670: Lock de dimmer manual explícito (L2) por frame.
   * Si el operador toca dimmer, ese valor se vuelve piso HTP del canal.
   */
  private readonly _manualDimmerLocks = new Map<NodeId, number>()

  /**
   * Inhibit limits (L2.5 — post-arbitraje, pre-retorno):
   * nodeId → cap 0-1 aplicado al canal `dimmer` del nodo.
   * Semánticamente: Grand Master per-fixture. No afecta L4 (blackout).
   * WAVE 4531: Opción B — el cap vive aquí, no en el bridge ni en el store.
   */
  private readonly _inhibitLimits = new Map<NodeId, number>()

  /** Effect intents (L3) */
  private _effectIntents: readonly INodeIntent[] = []

  /** Hephaestus custom clip intents (L3+ — Diamond Data direct curves) */
  private _hephaestusIntents: readonly INodeIntent[] = []

  /** Playback intents (LP — Chronos Timeline, prioridad entre L1-L3) */
  private _playbackIntents: readonly INodeIntent[] = []

  /** Grand Master (0-1) — multiplica todos los canales HTP */
  private _grandMaster = 1.0

  /** Blackout flag (L4) — se aplica en egress selectivo de intensidad */
  private _blackout = false

  // ── Buffers de salida pre-allocated ───────────────────────────────────

  /**
   * Mapa de resultado reutilizado frame a frame.
   * Key = nodeId, Value = Record<string, number> (valores 0-1 por canal).
   * Se muta in-place en `arbitrate()` — zero new Map() en hot path.
   */
  private readonly _result = new Map<NodeId, Record<string, number>>()

  /**
   * Pool de Records reutilizables — evita `{} ` en el hot path.
   * Crece hasta el número máximo de nodos activos simultáneamente
   * y luego se estabiliza (amortización GC).
   */
  private readonly _resultPool: Record<string, number>[] = []
  private _poolCursor = 0
  private _photonTracerFrame = 0

  // ── INodeArbiter API ──────────────────────────────────────────────────

  setSystemIntents(bus: IIntentBus): void {
    this._systemBus = bus
  }

  setSeleneOverrides(intents: readonly INodeIntent[]): void {
    this._seleneOverrides = intents
  }

  /**
   * WAVE 4663 — Registra el bus de L1 de Selene.
   * Llamado una vez durante la inicialización del motor.
   * El bus se limpia y rellena cada frame antes de arbitrate().
   */
  setSeleneBus(bus: IIntentBus): void {
    this._seleneBus = bus
  }

  setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void {
    this._manualOverrides.set(nodeId, channels)
  }

  /**
   * WAVE 4670: Inyecta el set de nodos COLOR de movers con rueda física.
   * Se calcula en patch time desde TitanOrchestrator; costo 0 en hot-path.
   */
  setMoverShieldNodeIds(nodeIds: readonly NodeId[]): void {
    this._moverShieldNodeIds.clear()
    for (let i = 0; i < nodeIds.length; i++) {
      this._moverShieldNodeIds.add(nodeIds[i])
    }
  }

  clearManualOverride(nodeId: NodeId): void {
    this._manualOverrides.delete(nodeId)
  }

  setEffectIntents(intents: readonly INodeIntent[]): void {
    this._effectIntents = intents
  }

  setHephaestusIntents(intents: readonly INodeIntent[]): void {
    this._hephaestusIntents = intents
  }

  setPlaybackIntents(intents: readonly INodeIntent[]): void {
    this._playbackIntents = intents
  }

  setBlackout(active: boolean): void {
    this._blackout = active
  }

  isBlackoutActive(): boolean {
    return this._blackout
  }

  setGrandMaster(value: number): void {
    this._grandMaster = value < 0 ? 0 : value > 1 ? 1 : value
  }

  getGrandMaster(): number {
    return this._grandMaster
  }

  /**
   * Ejecuta el arbitraje para el frame actual.
   *
   * PIPELINE:
   * 1. Reset del _resultPool cursor (reuse sin alloc)
   * 2. Recoger todos los intents de todas las capas en el _result
   * 3. Para cada canal de cada nodo, aplicar la estrategia de merge
   * 4. Aplicar Grand Master sobre canales HTP
  * 5. Retornar el _result como ArbitratedNodeMap (sin copiar)
   *
   * @returns Mapa inmutable de valores finales por nodo/canal (0-1)
   */
  arbitrate(): ArbitratedNodeMap {
    this._photonTracerFrame++

    // 1. Reset pool cursor — los objetos del pool se reusan
    this._poolCursor = 0
    // Limpiar el mapa de resultado anterior
    this._result.clear()

    // 2. Recolectar intents en orden ascendente de prioridad de capa.
    //    El orden de escritura garantiza que las capas superiores
    //    sobreescriban a las inferiores en el merge LTP.

    // L0: System intents (IntentBus)
    if (this._systemBus) {
      const all = this._systemBus.getAll()
      for (let i = 0; i < all.length; i++) {
        this._applyIntent(all[i], false)
      }
    }

    // L1: Selene IA overrides
    // WAVE 4663: bus dedicado (zero-alloc). Si count=0 (Silence Rule) → no-op total.
    // L0 (Liquid/VMM) retoma el control en el mismo frame en que Selene calla.
    if (this._seleneBus !== null) {
      const count = this._seleneBus.count
      for (let i = 0; i < count; i++) {
        this._applyIntent(this._seleneBus.getAt(i), true)
      }
    } else {
      // Fallback legacy: array de overrides pre-WAVE-4663
      for (let i = 0; i < this._seleneOverrides.length; i++) {
        this._applyIntent(this._seleneOverrides[i], true)
      }
    }

    // LP: Playback (Chronos Timeline) — entre L1 y L3
    for (let i = 0; i < this._playbackIntents.length; i++) {
      this._applyIntent(this._playbackIntents[i], false)
    }

    // L3: Effect intents
    for (let i = 0; i < this._effectIntents.length; i++) {
      this._applyIntent(this._effectIntents[i], false)
    }

    // L3+: Hephaestus custom intents (Diamond Data direct curves)
    for (let i = 0; i < this._hephaestusIntents.length; i++) {
      this._applyIntent(this._hephaestusIntents[i], false)
    }

    // L2: Manual overrides (tienen prioridad sobre effects)
    // Se aplican directamente sobre el _result, sin pasar por _applyIntent
    this._manualDimmerLocks.clear()
    for (const [nodeId, channels] of this._manualOverrides) {
      let record = this._result.get(nodeId)
      if (!record) {
        record = this._acquireRecord()
        this._result.set(nodeId, record)
      }

      const manualDimmer = channels['dimmer']
      if (Number.isFinite(manualDimmer)) {
        const clamped = manualDimmer < 0 ? 0 : manualDimmer > 1 ? 1 : manualDimmer
        this._manualDimmerLocks.set(nodeId, clamped)
      }

      // WAVE 4661 PASO 1 — escritura directa + órbita relativa.
      // Canales estándar (pan, tilt, dimmer…): LTP normal.
      // Canales orbit (pan_base, tilt_base): en lugar de sobrescribir,
      //   suman la desviación del LFO de L0 respecto al centro (0.5).
      //   resultado = clamp01(base + (L0 - 0.5))
      //   → el patrón gira siempre alrededor del punto exacto del radar.
      for (const key in channels) {
        if (key === 'pan_base') {
          const l0 = record['pan'] !== undefined ? record['pan'] : 0.5
          const v  = channels[key] + (l0 - 0.5)
          record['pan'] = v < 0 ? 0 : v > 1 ? 1 : v
        } else if (key === 'tilt_base') {
          const l0 = record['tilt'] !== undefined ? record['tilt'] : 0.5
          const v  = channels[key] + (l0 - 0.5)
          record['tilt'] = v < 0 ? 0 : v > 1 ? 1 : v
        } else {
          record[key] = channels[key]
        }
      }
    }

    // WAVE 4670: DIMMER AUTO-TAKE (ley del operador).
    // Si L2 tiene dimmer explícito, ese valor fija el piso HTP del canal
    // para impedir que capas inferiores lo apaguen durante el frame.
    if (this._manualDimmerLocks.size > 0) {
      for (const [nodeId, lockValue] of this._manualDimmerLocks) {
        const record = this._result.get(nodeId)
        if (!record) {
          continue
        }
        const current = record['dimmer']
        if (current === undefined || current < lockValue) {
          record['dimmer'] = lockValue
        }
      }
    }

    // 3. Aplicar Grand Master sobre canales HTP
    if (this._grandMaster !== 1.0) {
      for (const record of this._result.values()) {
        for (const ch of HTP_CHANNELS) {
          if (ch in record) {
            record[ch] = record[ch] * this._grandMaster
          }
        }
      }
    }

    // 4. WAVE 4531: Aplicar inhibit limits (L2.5, post-arbitraje).
    // Cap sobre el canal 'dimmer' del nodo registrado.
    // Se aplica DESPUÉS del Grand Master, ANTES de retornar.
    // El blackout se aplica en egress selectivo, no en el arbitraje.
    if (this._inhibitLimits.size > 0) {
      for (const [nodeId, limit] of this._inhibitLimits) {
        const record = this._result.get(nodeId)
        if (record && 'dimmer' in record) {
          const capped = record['dimmer'] * limit
          record['dimmer'] = capped < 0 ? 0 : capped > 1 ? 1 : capped
        }
      }
    }

    if (this._photonTracerFrame % PHOTON_TRACER_EVERY_FRAMES === 0) {
      // Silencio operacional WAVE 4627: sin telemetría legacy en el Arbiter.
    }

    return this._result as ArbitratedNodeMap
  }

  // ── Métodos internos ──────────────────────────────────────────────────

  /**
   * Aplica un intent al _result usando la estrategia de merge correcta.
   *
   * ZERO-ALLOC: accede al Record pre-allocated del pool si el nodo
   * no existe aún en el _result.
   */
  private _applyIntent(intent: INodeIntent, isSeleneLayer: boolean): void {
    let record = this._result.get(intent.nodeId)
    if (!record) {
      record = this._acquireRecord()
      this._result.set(intent.nodeId, record)
    }

    const values = intent.values
    const shieldedColorNode = isSeleneLayer && this._moverShieldNodeIds.has(intent.nodeId)
    for (const channel in values) {
      if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
        continue
      }

      const incoming = values[channel]

      if (HTP_CHANNELS.has(channel)) {
        // HTP: el valor más alto gana independientemente de la capa
        const current = record[channel]
        if (current === undefined || incoming > current) {
          record[channel] = incoming
        }
      } else {
        // LTP: la última escritura (capa más alta) gana
        // — Los intents llegan en orden ascendente de prioridad,
        //   así que simplemente sobreescribir es correcto.
        record[channel] = incoming
      }
    }
  }

  /**
   * WAVE 4529: Limpia TODOS los overrides manuales (L2) de golpe.
   * Equivalente semántico a "UNLOCK ALL" global.
   * Usado por AetherIPCHandlers cuando el Programmer libera todos los fixtures.
   */
  clearAllManualOverrides(): void {
    this._manualOverrides.clear()
  }

  /**
   * WAVE 4529: Lista los nodeIds que tienen overrides manuales activos.
   * Útil para debug/telemetría.
   */
  getManualOverrideNodeIds(): readonly string[] {
    return [...this._manualOverrides.keys()]
  }

  // ── Inhibit Limit API (WAVE 4531) ─────────────────────────────────────

  /**
   * WAVE 4531: Registra un inhibit limit (cap 0-1) sobre el canal `dimmer`
   * del nodo indicado. El cap se aplica post-arbitraje, antes de retornar
  * el resultado — sin alterar ninguna capa.
   *
   * @param nodeId  NodeId en formato Aether (ej: 'fix-01:impact')
   * @param limit   Valor 0-1. 1.0 = sin límite. 0.0 = oscuro total.
   */
  setInhibitLimit(nodeId: NodeId, limit: number): void {
    const clamped = limit < 0 ? 0 : limit > 1 ? 1 : limit
    this._inhibitLimits.set(nodeId, clamped)
  }

  /**
   * WAVE 4531: Elimina el inhibit limit de un nodo concreto.
   */
  clearInhibitLimit(nodeId: NodeId): void {
    this._inhibitLimits.delete(nodeId)
  }

  /**
   * WAVE 4531: Elimina TODOS los inhibit limits.
   */
  clearAllInhibitLimits(): void {
    this._inhibitLimits.clear()
  }

  // ── L2 Read API (WAVE 4653) ───────────────────────────────────────────

  /**
   * WAVE 4653: Devuelve los overrides manuales L2 actuales para los
   * nodeIds especificados. Cada nodeId tiene formato "<fixtureId>:<familyLabel>".
   *
   * El retorno es un objeto plano serializable (apto para IPC):
   *   { [nodeId]: Record<string, number> | null }
   * null significa que el nodo no tiene overrides activos en L2.
   *
   * @param nodeIds  Array de nodeIds a consultar
   */
  getManualOverridesForNodes(
    nodeIds: readonly string[],
  ): Record<string, Record<string, number> | null> {
    const result: Record<string, Record<string, number> | null> = {}
    for (const nodeId of nodeIds) {
      const overrides = this._manualOverrides.get(nodeId)
      result[nodeId] = overrides != null ? { ...overrides } : null
    }
    return result
  }

  /**
   * Obtiene un Record del pool o crea uno nuevo si el pool está agotado.
   *
   * El pool crece hasta el máximo de nodos activos simultáneamente
   * y luego se estabiliza. GC amortizado a cero tras warm-up.
   */
  private _acquireRecord(): Record<string, number> {
    if (this._poolCursor < this._resultPool.length) {
      const rec = this._resultPool[this._poolCursor++]
      // Limpiar el Record reutilizado de forma eficiente
      for (const key in rec) {
        delete rec[key]
      }
      return rec
    }
    // Pool exhausto: crear nuevo (solo durante warm-up)
    const rec: Record<string, number> = {}
    this._resultPool.push(rec)
    this._poolCursor++
    return rec
  }
}
