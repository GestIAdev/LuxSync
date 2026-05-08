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
 * - L4: Blackout (siempre gana)
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
const PHOTON_TRACER_EVERY_FRAMES = 20

/**
 * NodeArbiter — Implementación zero-alloc del árbitro multicapa.
 */
export class NodeArbiter implements INodeArbiter {

  // ── Estado por frame ──────────────────────────────────────────────────

  /** Bus de intents de los Systems (L0) */
  private _systemBus: IIntentBus | null = null

  /** Overrides Selene IA (L1) */
  private _seleneOverrides: readonly INodeIntent[] = []

  /** Manual overrides (L2): nodeId → { channel: value } */
  private readonly _manualOverrides = new Map<NodeId, Readonly<Record<string, number>>>()

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

  /** Blackout flag (L4) — colapsa toda salida a 0 */
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

  setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void {
    this._manualOverrides.set(nodeId, channels)
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
   * 5. Si blackout → colapsar todos los canales HTP a 0
   * 6. Retornar el _result como ArbitratedNodeMap (sin copiar)
   *
   * @returns Mapa inmutable de valores finales por nodo/canal (0-1)
   */
  arbitrate(): ArbitratedNodeMap {
    this._photonTracerFrame++

    // 1. Reset pool cursor — los objetos del pool se reusan
    this._poolCursor = 0
    // Limpiar el mapa de resultado anterior
    this._result.clear()

    // Blackout global: retornar mapa vacío — el NodeResolver
    // escribe los defaultValues de cada canal cuando no hay entrada
    if (this._blackout) {
      return this._result as ArbitratedNodeMap
    }

    // 2. Recolectar intents en orden ascendente de prioridad de capa.
    //    El orden de escritura garantiza que las capas superiores
    //    sobreescriban a las inferiores en el merge LTP.

    // L0: System intents (IntentBus)
    if (this._systemBus) {
      const all = this._systemBus.getAll()
      for (let i = 0; i < all.length; i++) {
        this._applyIntent(all[i])
      }
    }

    // L1: Selene IA overrides
    for (let i = 0; i < this._seleneOverrides.length; i++) {
      this._applyIntent(this._seleneOverrides[i])
    }

    // LP: Playback (Chronos Timeline) — entre L1 y L3
    for (let i = 0; i < this._playbackIntents.length; i++) {
      this._applyIntent(this._playbackIntents[i])
    }

    // L3: Effect intents
    for (let i = 0; i < this._effectIntents.length; i++) {
      this._applyIntent(this._effectIntents[i])
    }

    // L3+: Hephaestus custom intents (Diamond Data direct curves)
    for (let i = 0; i < this._hephaestusIntents.length; i++) {
      this._applyIntent(this._hephaestusIntents[i])
    }

    // L2: Manual overrides (tienen prioridad sobre effects)
    // Se aplican directamente sobre el _result, sin pasar por _applyIntent
    for (const [nodeId, channels] of this._manualOverrides) {
      let record = this._result.get(nodeId)
      if (!record) {
        record = this._acquireRecord()
        this._result.set(nodeId, record)
      }
      // Manual override: escritura directa, sin merge
      for (const key in channels) {
        record[key] = channels[key]
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
    // L4 (blackout) ya colapsa todo antes de llegar aquí — irrelevante.
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
  private _applyIntent(intent: INodeIntent): void {
    let record = this._result.get(intent.nodeId)
    if (!record) {
      record = this._acquireRecord()
      this._result.set(intent.nodeId, record)
    }

    const values = intent.values
    for (const channel in values) {
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
   * el resultado — sin alterar ninguna capa. L4 (blackout) sigue ganando.
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
