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
const HTP_CHANNELS = new Set<string>(['dimmer', 'brightness', 'strobe', 'shutter'])
const MOVER_SHIELD_BLOCKED_CHANNELS = new Set<string>([
  'r', 'g', 'b',
  'red', 'green', 'blue',
  'white', 'amber',
])
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = new Set<string>(['pan_base', 'tilt_base'])
const PHOTON_TRACER_EVERY_FRAMES = 20

function isFiniteChannelValue(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}

type ArbiterLayer = 'system' | 'selene' | 'playback' | 'effect' | 'hephaestus'

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
   * Pasaporte diplomático por frame para la capa Selene (L1).
   * Cuando está activo, los canales de color NO son bloqueados por Mover Shield.
   */
  private _seleneOverrideMoverShield = false

  /**
   * WAVE 4670: Lock de dimmer manual explícito (L2) por frame.
   * Si el operador toca dimmer, ese valor se vuelve piso HTP del canal.
   */
  /**
   * WAVE 4713: Fixtures con dimmer manual activo (prefijo fixtureId).
   * Se usa para bloquear intents L0 no cinéticos que causen tics visuales.
   */
  private readonly _manualDimmerFixtureIds = new Set<string>()
  private readonly _manualDimmerLocks = new Map<NodeId, number>()
  private readonly _manualChannelLocks = new Map<NodeId, Record<string, number>>()

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

  /**
   * WAVE 4675: Permite a efectos diplomáticos de Selene colorear movers
   * con rueda física en ventanas controladas (DarkSpin + HarmonicQuantizer
   * siguen siendo la barrera mecánica real en resolver/egress).
   */
  setSeleneOverrideMoverShield(active: boolean): void {
    this._seleneOverrideMoverShield = active
  }

  clearManualOverride(nodeId: NodeId): void {
    this._manualOverrides.delete(nodeId)
  }

  /**
   * WAVE 4718: Lectura del anchor de L2 para el motor cinético.
   * Devuelve los `pan_base`/`tilt_base` actuales del nodo (0-1),
   * o undefined si no hay override manual para ese nodeId.
   * Zero-lock: solo lectura del Map, sin alloc.
   */
  getManualOverride(nodeId: NodeId): Readonly<Record<string, number>> | undefined {
    return this._manualOverrides.get(nodeId)
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

    // WAVE 4713: precomputar fixtures con dimmer manual activo desde L2.
    // Se hace ANTES de aplicar L0 para bloquear ruido visual nativo.
    this._manualDimmerFixtureIds.clear()
    for (const [nodeId, channels] of this._manualOverrides) {
      const manualDimmer = channels['dimmer']
      if (!isFiniteChannelValue(manualDimmer)) continue
      const sep = nodeId.lastIndexOf(':')
      if (sep > 0) this._manualDimmerFixtureIds.add(nodeId.slice(0, sep))
    }

    // 2. Recolectar intents en orden ascendente de prioridad de capa.
    //    El orden de escritura garantiza que las capas superiores
    //    sobreescriban a las inferiores en el merge LTP.

    // L0: System intents (IntentBus)
    if (this._systemBus) {
      const all = this._systemBus.getAll()
      for (let i = 0; i < all.length; i++) {
        this._applyIntent(all[i], 'system')
      }
    }

    // L1: Selene IA overrides
    // WAVE 4663: bus dedicado (zero-alloc). Si count=0 (Silence Rule) → no-op total.
    // L0 (Liquid/VMM) retoma el control en el mismo frame en que Selene calla.
    if (this._seleneBus !== null) {
      const count = this._seleneBus.count
      for (let i = 0; i < count; i++) {
        this._applyIntent(this._seleneBus.getAt(i), 'selene')
      }
    } else {
      // Fallback legacy: array de overrides pre-WAVE-4663
      for (let i = 0; i < this._seleneOverrides.length; i++) {
        this._applyIntent(this._seleneOverrides[i], 'selene')
      }
    }

    // LP: Playback (Chronos Timeline) — entre L1 y L3
    for (let i = 0; i < this._playbackIntents.length; i++) {
      this._applyIntent(this._playbackIntents[i], 'playback')
    }

    // L2: Manual overrides (UI Hold)
    // Se aplican directamente sobre el _result, sin pasar por _applyIntent
    this._manualDimmerLocks.clear()
    this._manualChannelLocks.clear()
    for (const [nodeId, channels] of this._manualOverrides) {
      let record = this._result.get(nodeId)
      if (!record) {
        record = this._acquireRecord()
        this._result.set(nodeId, record)
      }

      const manualDimmer = channels['dimmer']
      if (isFiniteChannelValue(manualDimmer)) {
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
        const incoming = channels[key]
        if (!isFiniteChannelValue(incoming)) {
          continue
        }

        if (!MANUAL_HARD_LOCK_EXCLUDED_CHANNELS.has(key)) {
          let lockRecord = this._manualChannelLocks.get(nodeId)
          if (!lockRecord) {
            lockRecord = {}
            this._manualChannelLocks.set(nodeId, lockRecord)
          }
          lockRecord[key] = incoming
        }

        if (key === 'pan_base') {
          // WAVE L2-SUPREMACY: pan_base ES la posición final exclusiva.
          // AetherKineticEngine ya incorpora anchor_radar + oscilación en pan_base.
          // El delta L0 (VMM/Choreo) es descartado — cero mezcla aditiva.
          record['pan'] = incoming < 0 ? 0 : incoming > 1 ? 1 : incoming
        } else if (key === 'tilt_base') {
          // Ídem para tilt.
          record['tilt'] = incoming < 0 ? 0 : incoming > 1 ? 1 : incoming
        } else {
          record[key] = incoming
        }
      }
    }

    // L3: Effect intents (WAVE 4705 — autoridad sobre L2 manual)
    for (let i = 0; i < this._effectIntents.length; i++) {
      this._applyIntent(this._effectIntents[i], 'effect')
    }

    // L3+: Hephaestus custom intents (Diamond Data direct curves)
    for (let i = 0; i < this._hephaestusIntents.length; i++) {
      this._applyIntent(this._hephaestusIntents[i], 'hephaestus')
    }

    // WAVE 4714: MANUAL HARD LOCK (ley del operador).
    // Reaplica todos los canales manuales L2 (salvo orbit base channels)
    // después de L3/L3+ para evitar intrusiones de capas automáticas.
    if (this._manualChannelLocks.size > 0) {
      for (const [nodeId, lockChannels] of this._manualChannelLocks) {
        let record = this._result.get(nodeId)
        if (!record) {
          record = this._acquireRecord()
          this._result.set(nodeId, record)
        }
        for (const ch in lockChannels) {
          const v = lockChannels[ch]
          if (!isFiniteChannelValue(v)) continue
          record[ch] = v
        }
      }
    }

    // WAVE 4670 + 4709 + 4710: MANUAL INTENSITY LOCK (ley del operador).
    // Si L2 tiene dimmer explícito, ese valor se impone de forma ABSOLUTA sobre
    // dimmer/brightness para congelar intensidad fija (sin pulso L0/L3).
    // Además se replica al nodo hermano :color del mismo fixture para cubrir
    // PAR RGB puros cuyo atenuador vive en brightness de COLOR.
    if (this._manualDimmerLocks.size > 0) {
      for (const [nodeId, lockValue] of this._manualDimmerLocks) {
        let record = this._result.get(nodeId)
        if (!record) {
          record = this._acquireRecord()
          this._result.set(nodeId, record)
        }
        record['dimmer'] = lockValue
        record['brightness'] = lockValue

        const sep = nodeId.lastIndexOf(':')
        if (sep > 0) {
          const fixtureId = nodeId.slice(0, sep)
          const fixturePrefix = `${fixtureId}:`

          // WAVE 4711 HOTFIX SHOWTIME:
          // Lock de intensidad por FIXTURE completo para neutralizar rutas
          // anómalas de extracción (familias no estándar / nodeId raros).
          for (const [candidateNodeId, candidateRecord] of this._result) {
            if (!candidateNodeId.startsWith(fixturePrefix)) continue
            candidateRecord['dimmer'] = lockValue
            candidateRecord['brightness'] = lockValue
          }

          // Crear/forzar también el nodo :color aunque no exista aún en _result.
          const colorNodeId = `${fixtureId}:color`
          let colorRecord = this._result.get(colorNodeId)
          if (!colorRecord) {
            colorRecord = this._acquireRecord()
            this._result.set(colorNodeId, colorRecord)
          }
          colorRecord['dimmer'] = lockValue
          colorRecord['brightness'] = lockValue
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

    return this._result as ArbitratedNodeMap
  }

  // ── Métodos internos ──────────────────────────────────────────────────

  /**
   * Aplica un intent al _result usando la estrategia de merge correcta.
   *
   * ZERO-ALLOC: accede al Record pre-allocated del pool si el nodo
   * no existe aún en el _result.
   */
  private _applyIntent(intent: INodeIntent, layer: ArbiterLayer): void {
    // WAVE 4713: si un fixture está bajo dimmer manual, ignorar intents L0
    // para familias visuales no-cinéticas. Así no se cuelan tics de color/
    // intensidad desde rutas automáticas del extractor.
    if (layer === 'system' && this._manualDimmerFixtureIds.size > 0) {
      const sep = intent.nodeId.lastIndexOf(':')
      if (sep > 0) {
        const fixtureId = intent.nodeId.slice(0, sep)
        if (this._manualDimmerFixtureIds.has(fixtureId)) {
          const family = intent.nodeId.slice(sep + 1)
          if (family !== 'kinetic' && family !== 'atmosphere') {
            return
          }
        }
      }
    }

    let record = this._result.get(intent.nodeId)
    if (!record) {
      record = this._acquireRecord()
      this._result.set(intent.nodeId, record)
    }

    const values = intent.values
    const shieldedColorNode =
      layer === 'selene' &&
      !this._seleneOverrideMoverShield &&
      this._moverShieldNodeIds.has(intent.nodeId)
    for (const channel in values) {
      if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
        continue
      }

      const incoming = values[channel]
      if (!isFiniteChannelValue(incoming)) {
        continue
      }

      if (HTP_CHANNELS.has(channel)) {
        // WAVE 4705: L3 dimmer=0 debe poder apagar un hold manual (priority destructive).
        if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
          record[channel] = 0
          continue
        }
        // CLEAN CABIN: L2 DICTATOR — si el operador tiene un lock manual sobre
        // este canal HTP (dimmer/strobe/shutter), L0/L1/LP NO pueden pisarlo
        // con HTP. El MANUAL HARD LOCK post-L3 lo repondría igualmente,
        // pero este guard temprano evita que la capa intermedia herede
        // el valor alto de L0 antes del lock final, eliminando flashes de un frame.
        // L3 (effect) y L3+ (hephaestus) conservan autoridad destructiva.
        if (layer !== 'effect' && layer !== 'hephaestus') {
          const lockRecord = this._manualChannelLocks.get(intent.nodeId)
          if (lockRecord !== undefined && channel in lockRecord) {
            continue
          }
        }
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
