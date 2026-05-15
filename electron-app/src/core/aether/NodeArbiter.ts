/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚖️  AETHER MATRIX — NODE ARBITER (IMPLEMENTACIÓN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.4: Implementación concreta del INodeArbiter.
 * WAVE 4775: El Árbitro de Hierro — refactor forense completo.
 * WAVE 4752: THE SMART GATE — Máscara granular per-node/per-channel.
 *
 * El NodeArbiter resuelve conflictos multicapa sobre los CapabilityNodes.
 * Opera sobre valores normalizados (0-1) producidos por los 5 Systems
 * y los hooks externos (Selene, Manual, Effects, Playback).
 *
 * ESTRATEGIAS DE MERGE POR CANAL (WAVE 4752):
 * - `dimmer`, `brightness` → LTP absoluto: L2 gana cuando está activo.
 *   L0 sigue fluyendo mientras L2 NO toque ese canal específico.
 * - `strobe`, `shutter` → PRIORIDAD ESTRICTA POR CAPA (L4>LP>L3>L2>L1>L0).
 *   HTP solo dentro de L0 (multi-fuente en el mismo bus).
 * - todos los demás → LTP por canal-tocado: L0 escribe si L2/LP NO
 *   escribieron ese canal en ese nodo específico.
 *
 * SMART GATE (WAVE 4752 — reemplaza OPAQUE MASK fixture-wide de WAVE 4775):
 * - Tracking per-node de los canales que L2/LP están tocando este frame.
 * - L0/L1 solo bloqueados en los canales exactos que L2/LP escribieron.
 * - Un toque de dimmer en :impact NO bloquea color de L0 en :color.
 * - Un toque de color en :color NO afecta dimmer de :impact.
 * - Release Time: al liberar un override, fade ease-out al estado L0.
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
 * - `_opaqueNodeChannels` usa Set pool — sin alloc en hot path.
 * - No se crean nuevos Maps, Sets ni Arrays durante `arbitrate()`.
 *
 * @module core/aether/NodeArbiter
 * @version WAVE 4752 — The Smart Gate
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

// ── Canales con prioridad estricta por capa (WAVE 4775 / 4752) ─────────────
// strobe/shutter: prioridad estricta descendente (L4>LP>L3>L2>L1>L0).
// HTP solo dentro de L0 (multi-fuente en el mismo bus).
// dimmer/brightness: ahora LTP absoluto — L2 gana cuando está activo;
// L0 sigue fluyendo si L2 NO toca ese canal en ese nodo.
const STRICT_PRIORITY_CHANNELS = new Set<string>(['strobe', 'shutter'])

// ── WAVE 4752: SMART GATE — bloqueo per-node/per-channel ────────────────────
// Reemplaza OPAQUE_BLOCKED_CHANNELS_L0_L1 (fixture-wide).
// El tracking de canales-tocados se hace en _opaqueNodeChannels y
// _opaquePlaybackChannels, populados en arbitrate() antes de aplicar L0/L1.
// No es una lista estática — es un mapa dinámico por canal exacto.

const MOVER_SHIELD_BLOCKED_CHANNELS = new Set<string>([
  'r', 'g', 'b',
  'red', 'green', 'blue',
  'white', 'amber',
])
// ── Canales excluidos del Hard Lock (siguen lógica especial del motor cinético)
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = new Set<string>(['pan_base', 'tilt_base'])

// ── WAVE 4752: Canales con duración de release larga (movers) ────────────────
// Estos canales usan RELEASE_MS_SLOW (1000ms) al soltar el override.
// El resto usa RELEASE_MS_FAST (200ms).
const SLOW_RELEASE_CHANNELS = new Set<string>(['pan', 'tilt', 'zoom', 'focus', 'rotation'])
const RELEASE_MS_FAST = 200
const RELEASE_MS_SLOW = 1000
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

  /**
   * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por L2.
   * Key = nodeId, Value = Set de nombres de canal que L2 escribió este frame.
   * L0/L1 solo bloqueados en los canales exactos presentes en estos Sets.
   * Populado y limpiado cada frame en arbitrate(). Pool de Sets para zero-alloc.
   */
  private readonly _opaqueNodeChannels = new Map<string, Set<string>>()

  /**
   * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por LP.
   * Misma semántica que _opaqueNodeChannels pero para Playback Timeline.
   */
  private readonly _opaquePlaybackChannels = new Map<string, Set<string>>()

  /** Pool de Sets reutilizables para zero-alloc en _opaqueNodeChannels/LP */
  private readonly _channelSetPool: Set<string>[] = []
  private _channelSetCursor = 0

  /**
   * WAVE 4752: RELEASE TIME — estados de fade al soltar overrides manuales.
   * Key = nodeId, Value = snapshot del override en el momento del clear.
   * Se interpola ease-out cúbico durante la duración configurada.
   */
  private readonly _releaseStates = new Map<string, {
    channels: Record<string, number>
    startedAtMs: number
    durationByChannel: Record<string, number>  // ms por canal (200 o 1000)
  }>()

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

  /**
   * WAVE L2-SUPREMACY: Output del motor cinético nativo (AetherKineticEngine).
   * Mapa separado de _manualOverrides — sin colisión con anchor del radar ni con
   * ProgrammerAetherBridge. Se aplica como última autoridad en arbitrate(),
   * después del MANUAL HARD LOCK y del Grand Master.
   * Key = `${fixtureId}:kinetic`, Value = { pan_base, tilt_base } computados.
   */
  private readonly _motorKineticOverrides = new Map<NodeId, Readonly<Record<string, number>>>()

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
    const existing = this._manualOverrides.get(nodeId)
    if (existing !== undefined) {
      // Merge in-place: los canales entrantes actualizan los existentes sin borrar otros.
      // Garantiza que KineticsBridge (anchor pan_base/tilt_base) y ProgrammerAetherBridge
      // (speed) no se destruyan mutuamente al escribir el mismo nodo :kinetic.
      const mutable = existing as Record<string, number>
      for (const key in channels) {
        mutable[key] = (channels as Record<string, number>)[key]
      }
    } else {
      this._manualOverrides.set(nodeId, channels)
    }
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

  clearManualOverride(nodeId: NodeId, _releaseMs?: number): void {
    const channels = this._manualOverrides.get(nodeId)
    if (channels) {
      // Capturar snapshot para el fade de retorno
      const snapshot: Record<string, number> = {}
      const durationByChannel: Record<string, number> = {}
      for (const key in channels) {
        const v = (channels as Record<string, number>)[key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          snapshot[key] = v
          durationByChannel[key] = SLOW_RELEASE_CHANNELS.has(key) ? RELEASE_MS_SLOW : RELEASE_MS_FAST
        }
      }
      if (Object.keys(snapshot).length > 0) {
        this._releaseStates.set(nodeId, {
          channels: snapshot,
          startedAtMs: performance.now(),
          durationByChannel,
        })
      }
    }
    this._manualOverrides.delete(nodeId)
  }

  /**
   * WAVE L2-SUPREMACY: Registra el output computado del motor cinético nativo.
   * Solo AetherKineticEngine debe llamar este método.
   * Separado de _manualOverrides para evitar colisión anchor↔output.
   */
  setMotorKineticOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void {
    this._motorKineticOverrides.set(nodeId, channels)
  }

  clearMotorKineticOverride(nodeId: NodeId): void {
    this._motorKineticOverrides.delete(nodeId)
  }

  clearAllMotorKineticOverrides(): void {
    this._motorKineticOverrides.clear()
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

    // WAVE 4752: SMART GATE — pre-computar canales tocados por L2/LP por nodo.
    // Sustituye el fixture-wide opaque mask de WAVE 4775.
    // L0/L1 solo bloqueados en los canales exactos que L2/LP están escribiendo.
    this._channelSetCursor = 0
    this._opaqueNodeChannels.clear()
    this._opaquePlaybackChannels.clear()

    // L2: registrar canales tocados por nodo
    for (const [nodeId, channels] of this._manualOverrides) {
      let set = this._opaqueNodeChannels.get(nodeId)
      if (!set) {
        set = this._acquireChannelSet()
        this._opaqueNodeChannels.set(nodeId, set)
      }
      for (const key in channels) {
        const v = (channels as Record<string, number>)[key]
        if (typeof v === 'number' && Number.isFinite(v)) set.add(key)
      }
    }

    // LP: registrar canales tocados por nodo
    for (let i = 0; i < this._playbackIntents.length; i++) {
      const intent = this._playbackIntents[i]
      let set = this._opaquePlaybackChannels.get(intent.nodeId)
      if (!set) {
        set = this._acquireChannelSet()
        this._opaquePlaybackChannels.set(intent.nodeId, set)
      }
      for (const key in intent.values) {
        const v = (intent.values as Record<string, number>)[key]
        if (typeof v === 'number' && Number.isFinite(v)) set.add(key)
      }
    }

    // WAVE 4713 COMPAT: dimmer fixture tracking sigue activo para bloquear
    // intents de familia completa (kinetic/atmosphere pasan igual).
    this._manualDimmerFixtureIds.clear()
    for (const [nodeId, channels] of this._manualOverrides) {
      const manualDimmer = (channels as Record<string, number>)['dimmer']
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
    // 🔬 WAVE 4735.6 DIAG: log every 200 frames how many L2 overrides we have
    const _l2Count = this._manualOverrides.size
    if (this._photonTracerFrame % 200 === 0 && _l2Count > 0) {
      const _sampleKeys = [...this._manualOverrides.keys()].slice(0, 3)
      console.log(
        `[NodeArbiter L2-DIAG] frame=${this._photonTracerFrame} | ` +
        `manualOverrides=${_l2Count} | samples:[${_sampleKeys.join(',')}]`
      )
    }
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

        // pan_base/tilt_base en _manualOverrides son el anchor del radar (escritos por
        // KineticsBridge._flushClassic). Se almacenan tal cual — NO se traducen a pan/tilt
        // aquí. La traducción final ocurre exclusivamente en el bloque L2-MOTOR
        // (post-hardlock), ejecutado por AetherKineticEngine vía _motorKineticOverrides.
        record[key] = incoming
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

    // WAVE 4752: MANUAL INTENSITY LOCK — node-wide (no fixture-wide).
    // Solo el nodo que el operador tocó queda lockeado en dimmer/brightness.
    // Los nodos hermanos (otros cells, otras familias) siguen siendo
    // gobernados por L0 según sus propias reglas LTP.
    if (this._manualDimmerLocks.size > 0) {
      for (const [nodeId, lockValue] of this._manualDimmerLocks) {
        let record = this._result.get(nodeId)
        if (!record) {
          record = this._acquireRecord()
          this._result.set(nodeId, record)
        }
        record['dimmer'] = lockValue
        record['brightness'] = lockValue
      }
    }

    // WAVE 4752: RELEASE FADES — interpolación ease-out al soltar overrides.
    // Se aplica DESPUÉS de L2/L3 y ANTES del Grand Master.
    if (this._releaseStates.size > 0) {
      this._applyReleaseFades()
    }

    // 3. Aplicar Grand Master sobre canales de intensidad.
    // dimmer y brightness son ahora LTP (no están en STRICT_PRIORITY_CHANNELS)
    // pero sí escalan con el Grand Master.
    if (this._grandMaster !== 1.0) {
      for (const record of this._result.values()) {
        for (const ch of STRICT_PRIORITY_CHANNELS) {
          if (ch in record) {
            record[ch] = record[ch] * this._grandMaster
          }
        }
        if ('dimmer' in record) record['dimmer'] = record['dimmer'] * this._grandMaster
        if ('brightness' in record) record['brightness'] = record['brightness'] * this._grandMaster
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

    // WAVE L2-SUPREMACY — L2-MOTOR: output del AetherKineticEngine.
    // Aplicado DESPUÉS del Grand Master y los inhibit limits — el motor nativo
    // tiene la última palabra absoluta sobre pan/tilt de sus fixtures.
    // Nunca mezcla aditiva: el engine ya embedió el anchor_radar en el cómputo.
    for (const [nodeId, channels] of this._motorKineticOverrides) {
      let record = this._result.get(nodeId)
      if (!record) {
        record = this._acquireRecord()
        this._result.set(nodeId, record)
      }
      const panBase  = channels['pan_base']
      const tiltBase = channels['tilt_base']
      if (isFiniteChannelValue(panBase)) {
        record['pan']  = panBase  < 0 ? 0 : panBase  > 1 ? 1 : panBase
      }
      if (isFiniteChannelValue(tiltBase)) {
        record['tilt'] = tiltBase < 0 ? 0 : tiltBase > 1 ? 1 : tiltBase
      }
    }

    return this._result as ArbitratedNodeMap
  }

  // ── Métodos internos ──────────────────────────────────────────────────

  /**
   * Aplica un intent al _result usando la estrategia de merge correcta.
   *
   * WAVE 4775 — ÁRBITRO DE HIERRO:
   * - STRICT_PRIORITY_CHANNELS (dimmer/strobe/shutter/brightness):
   *   Prioridad estricta por capa. L4>LP>L3>L2>L1>L0.
   *   Un valor ya escrito por capa superior NO puede ser pisado por
   *   una capa inferior, ni siquiera con HTP (max).
   *   HTP solo aplica dentro de L0 (múltiples sources en el mismo bus).
   * - Canales LTP: LTP normal (última capa en escribir gana).
   * - Opaque Mask: si el fixture es opaco, L0/L1 no pueden inyectar
   *   canales estéticos (OPAQUE_BLOCKED_CHANNELS_L0_L1).
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

    // WAVE 4752: SMART GATE — obtener canales bloqueados para este nodo.
    // L0/L1 solo bloqueados en canales que L2/LP están tocando EN ESE NODO.
    const l2BlockedChannels = (layer === 'system' || layer === 'selene')
      ? this._opaqueNodeChannels.get(intent.nodeId)
      : undefined
    const lpBlockedChannels = (layer === 'system' || layer === 'selene')
      ? this._opaquePlaybackChannels.get(intent.nodeId)
      : undefined

    const values = intent.values
    const shieldedColorNode =
      layer === 'selene' &&
      !this._seleneOverrideMoverShield &&
      this._moverShieldNodeIds.has(intent.nodeId)
    for (const channel in values) {
      // MoverShield: bloquea canales de color en L1 para movers con rueda física
      if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
        continue
      }

      // WAVE 4752: SMART GATE — bloqueo per-canal-tocado.
      // L0/L1 no pueden escribir un canal si L2 o LP lo están escribiendo
      // en ESTE NODO específico. Canales no tocados por L2/LP fluyen libres.
      if ((l2BlockedChannels?.has(channel) === true ||
           lpBlockedChannels?.has(channel) === true)) {
        continue
      }

      const incoming = values[channel]
      if (!isFiniteChannelValue(incoming)) {
        continue
      }

      if (STRICT_PRIORITY_CHANNELS.has(channel)) {
        // strobe/shutter: PRIORIDAD ESTRICTA POR CAPA.
        // Excepción: L3 (effect) con dimmer=0 tiene autoridad destructiva (WAVE 4705).
        if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
          record[channel] = 0
          continue
        }
        // L3+ (hephaestus) tiene autoridad total sobre todos los canales.
        if (layer === 'hephaestus') {
          record[channel] = incoming
          continue
        }
        // Para L0 (system): HTP DENTRO de L0 — múltiples sources del mismo bus.
        if (layer === 'system') {
          const current = record[channel]
          if (current === undefined || incoming > current) {
            record[channel] = incoming
          }
          continue
        }
        // L1, LP, L3 (effect no-zero): LTP estricto entre capas.
        record[channel] = incoming
      } else {
        // LTP: la última escritura (capa más alta) gana.
        // dimmer/brightness: LTP puro — L0 escribe libremente en canales
        // que L2 NO esté tocando (el Smart Gate ya los filtró arriba).
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
    this._motorKineticOverrides.clear()
    this._releaseStates.clear()
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

  /** Zero-alloc Set pool para _opaqueNodeChannels / _opaquePlaybackChannels */
  private _acquireChannelSet(): Set<string> {
    if (this._channelSetCursor < this._channelSetPool.length) {
      const s = this._channelSetPool[this._channelSetCursor++]
      s.clear()
      return s
    }
    const s = new Set<string>()
    this._channelSetPool.push(s)
    this._channelSetCursor++
    return s
  }

  /**
   * WAVE 4752: Aplica fades de retorno ease-out cúbico al soltar overrides.
   * Para cada nodo en _releaseStates, mezcla el snapshot del override
   * con el valor L0 ya en _result. Al terminar el fade (t=1), elimina el estado.
   */
  private _applyReleaseFades(): void {
    const now = performance.now()
    for (const [nodeId, rel] of this._releaseStates) {
      let record = this._result.get(nodeId)

      let fadeCompleted = true
      for (const key in rel.channels) {
        const duration = rel.durationByChannel[key] ?? RELEASE_MS_FAST
        const elapsed  = now - rel.startedAtMs
        if (elapsed < duration) fadeCompleted = false
        const t = elapsed >= duration ? 1.0 : elapsed / duration
        // Ease-out cúbico: suave al final — orgánico para movers
        const fadeWeight = 1.0 - t * t * t
        if (fadeWeight <= 0) continue

        const releaseValue = rel.channels[key]
        if (!record) {
          record = this._acquireRecord()
          this._result.set(nodeId, record)
        }
        const l0Value = record[key]
        if (l0Value !== undefined && Number.isFinite(l0Value)) {
          // Blend: snapshot del manual → valor L0 actual
          record[key] = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
        } else {
          // L0 no escribió este canal aún: fade a 0
          record[key] = releaseValue * fadeWeight
        }
      }

      if (fadeCompleted) {
        this._releaseStates.delete(nodeId)
      }
    }
  }

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
