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
 * - L4: Blackout (state flag; el gate final se aplica en egress)
 *
 * WAVE 7110-B: LP layer removed. Chronos now injects via _chronosBus
 * at L1 alongside Selene. Both share the same priority layer.
 *
 * ZERO-ALLOC EN HOT PATH:
 * - `_result` es un Map pre-existente que se muta in-place cada frame.
 * - Los Records internos se reusan vía `_resultPool` (object pool).
 * - `_opaqueNodeChannels` usa Set pool — sin alloc en hot path.
 * - No se crean nuevos Maps, Sets ni Arrays durante `arbitrate()`.
 *
 * WAVE 4914 — RELATIVE OFFSET ROUTING:
 * - Sustituye el pin absoluto del bloque L2-MOTOR por una fusión aditiva final.
 * - L2 (IK / AetherKineticEngine) escribe `pan_base`/`tilt_base` (centro de gravedad).
 * - L0 (KineticAdapter VMM) escribe `pan_offset`/`tilt_offset` ∈ [-1,+1] (órbita).
 * - Fórmula: `pan_final = clamp01(pan_base + pan_offset * amp * aspect * distScale * gimbalFactor)`.
 * - Gimbal Lock fade en pan_offset cuando tilt_base ≈ 0.5 (haz cenital/nadiral).
 *
 * @module core/aether/NodeArbiter
 * @version WAVE 4914 — Relative Offset Routing
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
// _opaqueChronosChannels, populados en arbitrate() antes de aplicar L0/L1.
// No es una lista estática — es un mapa dinámico por canal exacto.

const MOVER_SHIELD_BLOCKED_CHANNELS = new Set<string>([
  'r', 'g', 'b',
  'red', 'green', 'blue',
  'white', 'amber',
])
// ── Canales excluidos del Hard Lock (siguen lógica especial del motor cinético)
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = new Set<string>(['pan_base', 'tilt_base'])
// WAVE 4825: overrides flash de Tungsten no deben activar bloqueo fixture-wide
// legacy de WAVE 4713, o el wash del mismo fixture pierde L0 durante hold.
const FIXTURE_DIMMER_LOCK_EXEMPT_FAMILIES = new Set<string>([
  'golden-master',
  'petal-l',
  'petal-c',
  'petal-r',
])

// ── WAVE 4871: L3 LUMINANCE GAG — canales de luminancia del fixture padre ─────
// Si L3 (effect/hephaestus) escribe en CUALQUIER canal de un nodo :impact o
// :color, TODOS estos canales quedan dominados en _l3DominatedChannels para
// el fixture padre completo. L0 queda físicamente amordazado en luminancia.
const L3_LUMINANCE_GAG_CHANNELS = new Set<string>([
  'dimmer', 'strobe', 'shutter', 'master_brightness', 'brightness',
])
// Familias de nodo que disparan el Gag cuando L3 las escribe
const L3_GAG_TRIGGER_FAMILIES = new Set<string>(['impact', 'color'])

// ── WAVE 4752: Canales con duración de release larga (movers) ────────────────
// Estos canales usan RELEASE_MS_SLOW (1000ms) al soltar el override.
// El resto usa RELEASE_MS_FAST (200ms).
const SLOW_RELEASE_CHANNELS = new Set<string>(['pan', 'tilt', 'zoom', 'focus', 'rotation'])
const RELEASE_MS_FAST = 200
const RELEASE_MS_SLOW = 1000

// WAVE 6019.6 FIX — CORTAFUEGOS DE ENVENENAMIENTO IK:
// Las coordenadas espaciales (targetX/Y/Z) NO pueden interpolarse
// como ángulos DMX en el Release Fader. Si entran al snapshot,
// el NodeResolver mantiene la ruta IK activa durante el fade-out
// y los focos colapsan al techo (singularidad en X=0 para centrales).
const IK_POISON_KEYS = new Set(['targetX', 'targetY', 'targetZ', 'focusX', 'focusY', 'focusZ'])
const PHOTON_TRACER_EVERY_FRAMES = 20

// ── WAVE 4914: Relative Offset Routing ────────────────────────────────
// Factor de escala que mapea offset ∈ [-1,+1] a desviación DMX normalizada.
// 0.5 = legacy split-brain: `(x+1)/2 = 0.5 + x*0.5` se preserva cuando
// la base es 0.5 (sin IK), garantizando cero regresión visual.
const RELATIVE_OFFSET_SCALE_PAN  = 0.5
const RELATIVE_OFFSET_SCALE_TILT = 0.5
// WAVE 4980→7030: Límite físico superior del tilt en espacio normalizado [0, 1].
// ANTES 0.85 (~217 DMX) — recortaba 15% del recorrido útil superior, impidiendo
// que fixtures totem apuntaran al suelo (DMX 220-255) y que ceiling fixtures
// alcanzaran el horizonte. La causa raíz del clip era falta de orientation-aware
// tilt offset en el AetherKineticEngine (WAVE 7030 ya corrige eso).
// AHORA 0.95 (~242 DMX) — deja margen lógico anti-degenerado mientras el
// AetherSafetyMiddleware airbag (5 DMX) protege el hardware en [5, 250].
const TILT_ARBITER_MAX = 0.95
// WAVE 4988→7030: Límite físico inferior del tilt en espacio normalizado [0, 1].
// ANTES 0.15 (~38 DMX) — recortaba 15% del recorrido útil inferior, impidiendo
// que ceiling fixtures apuntaran al techo (DMX 0-38) tras la inversión del resolver.
// AHORA 0.05 (~13 DMX) — el airbag (5 DMX) sigue siendo la protección física final.
const TILT_ARBITER_MIN = 0.05

// Gimbal Lock fade: cuando el haz apunta cerca del cenit (tilt_base ≈ 0.5),
// el pan offset rota la carcasa sin desplazamiento visual del beam. Atenuamos
// el offset de pan dentro de una banda de ±GIMBAL_TILT_FADE_HALFWIDTH alrededor
// del centro para evitar el "spinning hat" mecánico.
const GIMBAL_TILT_CENTER          = 0.5
const GIMBAL_TILT_FADE_HALFWIDTH  = 10 / 255   // ~10 DMX byte = ~3.9% norm space
const RELATIVE_FUSION_LOG_EVERY_FRAMES = 220

function isFiniteChannelValue(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}

type ArbiterLayer = 'system' | 'selene' | 'chronos' | 'effect' | 'hephaestus' | 'calibration'

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
   * WAVE 4829: ABSOLUTE L3 OVERRIDE — Escudo Anti-Sangrado.
   * Registra los nodos + canales que L3 (effect/hephaestus) escribe en este frame.
   * L0 (system) y L1 (selene) NUNCA pueden sobrepasar a L3 en esos canales.
   * Limpiado al inicio de cada arbitrate(). Pool compartido con _opaqueNodeChannels.
   */
  private readonly _l3DominatedChannels = new Map<string, Set<string>>()

  /**
   * Pasaporte diplomático por frame para la capa Selene (L1).
   * Cuando está activo, los canales de color NO son bloqueados por Mover Shield.
   */
  private _seleneOverrideMoverShield = false

  /**
   * WAVE 4918.5: Nodos COLOR que L3 (Hephaestus) escribió en este frame.
   * Cuando Hephaestus emite color a un nodo mover (rueda de colores físicas),
   * L0 (Selene IA) debe callar COMPLETAMENTE en ese nodo.
   * Limpiado al inicio de cada arbitrate() junto con _l3DominatedChannels.
   */
  private readonly _l3HephColorNodeIds = new Set<NodeId>()

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

  /** L3++ Calibration intents (Live Calibration Mode — Hephaestus Canvas direct injection).
   *  Dominancia absoluta sobre L0/L1/L2/L3/L3+ por orden de escritura LTP.
   *  No requiere pausar ningún motor — machaca por capa. */
  private _calibrationIntents: readonly INodeIntent[] = []

  /** Watchdog: auto-clear calibration si no llega un nuevo inject en 500ms. */
  private _calibrationWatchdog: ReturnType<typeof setTimeout> | null = null
  private _calibrationLastInjectMs = 0

  /**
   * WAVE 7110-B: Bus dedicado para Chronos (L1).
   * Se actualiza cada frame por ChronosAetherAdapter antes de arbitrate().
   * Comparte la capa L1 con Selene — misma prioridad.
   */
  private _chronosBus: IIntentBus | null = null

  /**
   * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por L2.
   * Key = nodeId, Value = Set de nombres de canal que L2 escribió este frame.
   * L0/L1 solo bloqueados en los canales exactos presentes en estos Sets.
   * Populado y limpiado cada frame en arbitrate(). Pool de Sets para zero-alloc.
   */
  private readonly _opaqueNodeChannels = new Map<string, Set<string>>()

  /**
   * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por Chronos L1.
   * Misma semántica que _opaqueNodeChannels pero para Chronos bus.
   */
  private readonly _opaqueChronosChannels = new Map<string, Set<string>>()

  /** Pool de Sets reutilizables para zero-alloc en _opaqueNodeChannels/Chronos */
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

  /** 🛠️ WAVE 5034: Scratch array para getManualOverrideNodeIds — zero alloc. */
  private readonly _manualOverrideNodeIdsScratch: string[] = []

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

  /** WAVE 7172: Nodos con supresión IK espacial para este frame. */
  private readonly _spatialSuppressedNodes = new Set<string>()

  /**
   * MANUAL PATTERN LOCK — nodos con patrón manual L2 activo.
   * Cuando un nodeId está aquí, clearManualOverride preserva pan_base/tilt_base
   * para que el motor L2 no pierda su anchor. La capa SURVIVAL no puede
   * purgar el anchor mientras el patrón esté activo.
   * Registrado por AetherIPCHandlers.setManualPattern (activación).
   * Eliminado por setManualPattern release/hold o clearManualPatternLock.
   */
  private readonly _manualPatternLocks = new Set<NodeId>()

  /**
   * WAVE 4914: Amplitud global del flujo de offset relativo (escala el offset VMM).
   * 1.0 = legacy (preserva el mapeo `(intent.x+1)/2` cuando no hay base IK).
   * <1.0 = órbitas más pequeñas. >1.0 = sobrepasa el envelope (se recorta con clamp01).
   * Seteado externamente desde AetherIPCHandlers / Programmer UI.
   */
  private _relativeOffsetAmplitude = 1.0

  /**
   * WAVE 4914: Scale por nodo derivado de la distancia fixture→target.
   * Pre-computado en patch-time por `applySpatialTarget`. Default 1.0.
   * Permite que un mismo offset DMX produzca un arco visual similar para
   * fixtures cercanos y lejanos al objetivo (ver blueprint §3.2).
   */
  private readonly _spatialDistanceScales = new Map<NodeId, number>()

  /** WAVE 4914: contador throttled de logs de fusión. */
  private _fusionLogCounter = 0

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
    const incomingKeys = Object.keys(channels)
    const hasSpatial = incomingKeys.some(k => IK_POISON_KEYS.has(k))
    if (existing !== undefined) {
      // Merge in-place: los canales entrantes actualizan los existentes sin borrar otros.
      // Garantiza que KineticsBridge (anchor pan_base/tilt_base) y ProgrammerAetherBridge
      // (speed) no se destruyan mutuamente al escribir el mismo nodo :kinetic.
      const mutable = existing as Record<string, number>
      for (const key in channels) {
        mutable[key] = (channels as Record<string, number>)[key]
      }
      if (hasSpatial || IK_POISON_KEYS.has(incomingKeys[0] || '')) {
        console.log(`[ZOMBIE-DIAG] setManualOverride MERGE ${nodeId}: incoming=[${incomingKeys.join(',')}] postKeys=[${Object.keys(mutable).join(',')}]`)
      }
    } else {
      this._manualOverrides.set(nodeId, channels)
      if (hasSpatial) {
        console.log(`[ZOMBIE-DIAG] setManualOverride NEW ${nodeId}: keys=[${incomingKeys.join(',')}]`)
      }
    }
    // WAVE 4828: Cancel release fade si el override entrante escribe pan/tilt directamente.
    // WAVE 6020.7 FIX: NO cancelar si solo llegan pan_base/tilt_base (bridge VMM).
    // Un override de base no debe interrumpir el fade de posición del Unlock.
    const cancelsFade = incomingKeys.some(k => k === 'pan' || k === 'tilt')
    if (cancelsFade) {
      this._releaseStates.delete(nodeId)
    }
    // 🩸 WAVE 6040-DIAG: trace ALL kinetic overrides arriving at L2
    if (nodeId.includes(':kinetic') && (incomingKeys.some(k => k === 'pan' || k === 'tilt' || k === 'pan_base' || k === 'tilt_base'))) {
      console.log(`[ZOMBIE-DIAG] setManualOverride KINETIC ${nodeId}: keys=[${incomingKeys.join(',')}] existing=${existing ? 'YES' : 'NO'}`)
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

  clearManualOverride(nodeId: NodeId, releaseMs?: number): void {
    const channels = this._manualOverrides.get(nodeId)
    if (channels) {
      const allKeys = Object.keys(channels)
      const poisonKeys = allKeys.filter(k => IK_POISON_KEYS.has(k))
      if (poisonKeys.length > 0) {
        console.log(`[ZOMBIE-DIAG] clearManualOverride ${nodeId}: DELETING node that had POISON keys=[${poisonKeys.join(',')}] allKeys=[${allKeys.join(',')}]`)
      }
      // 🩸 WAVE 6040-DIAG: trace classic kinetic clears
      if (nodeId.includes(':kinetic') && (allKeys.some(k => k === 'pan' || k === 'tilt'))) {
        console.log(`[ZOMBIE-DIAG] 🔥 clearManualOverride KINETIC CLASSIC ${nodeId}: keys=[${allKeys.join(',')}] releaseMs=${releaseMs ?? 'default'}`)
      }
      // WAVE 6020 FIX: releaseMs === 0 salta el fade snapshot.
      // Usado por purgas destructivas (Unlock espacial) donde el operador
      // quiere liberar inmediatamente a L0 sin interpolar contra un patrón
      // automático recién nacido que tira el foco al techo.
      const skipFade = releaseMs === 0

      // MANUAL PATTERN LOCK: si el nodo tiene un patrón L2 activo,
      // preservar pan_base/tilt_base (anchor del motor). Solo limpiar
      // los demás canales (pan, tilt, dimmer, etc.) y set up fade para esos.
      const hasPatternLock = this._manualPatternLocks.has(nodeId)
      const anchorKeys = new Set(['pan_base', 'tilt_base'])

      if (hasPatternLock) {
        const nonAnchorKeys = allKeys.filter(k => !anchorKeys.has(k))
        if (nonAnchorKeys.length > 0) {
          console.log(`[ZOMBIE-DIAG] clearManualOverride PATTERN-LOCK ${nodeId}: preserving anchor [pan_base,tilt_base], clearing=[${nonAnchorKeys.join(',')}]`)
        }
        if (!skipFade) {
          const snapshot: Record<string, number> = {}
          const durationByChannel: Record<string, number> = {}
          for (const key of nonAnchorKeys) {
            if (IK_POISON_KEYS.has(key)) continue
            const v = (channels as Record<string, number>)[key]
            if (typeof v === 'number' && Number.isFinite(v)) {
              let snapshotKey = key
              if (key === 'pan_base') snapshotKey = 'pan'
              if (key === 'tilt_base') snapshotKey = 'tilt'
              snapshot[snapshotKey] = v
              durationByChannel[snapshotKey] = SLOW_RELEASE_CHANNELS.has(snapshotKey) ? RELEASE_MS_SLOW : RELEASE_MS_FAST
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
        // Remove non-anchor keys in-place, keep pan_base/tilt_base
        for (const key of nonAnchorKeys) {
          delete (channels as Record<string, number>)[key]
        }
        return
      }

      if (!skipFade) {
        // Capturar snapshot para el fade de retorno
        const snapshot: Record<string, number> = {}
        const durationByChannel: Record<string, number> = {}
        for (const key in channels) {
          // WAVE 6019.6 CORTAFUEGOS: Las coordenadas IK no son ángulos.
          // Interpolarlas hacia 0 fuerza la ruta IK en NodeResolver
          // durante todo el fade, colapsando los focos al techo.
          if (IK_POISON_KEYS.has(key)) continue

          const v = (channels as Record<string, number>)[key]
          if (typeof v === 'number' && Number.isFinite(v)) {
            // WAVE 6019.5 FIX: Normalizar keys cinéticas para que el
            // Release Fader pueda hacer blend con los canales que L0 escribe.
            // _manualOverrides guarda 'pan_base'/'tilt_base' (anchor de órbita)
            // pero L0 emite 'pan'/'tilt'. Sin normalización, l0Value siempre
            // es undefined y el fade nunca se ejecuta para kinetic.
            let snapshotKey = key
            if (key === 'pan_base') snapshotKey = 'pan'
            if (key === 'tilt_base') snapshotKey = 'tilt'
            snapshot[snapshotKey] = v
            // WAVE 6019.6: usar snapshotKey (normalizado) en lugar de key
            // para que pan_base→pan y tilt_base→tilt hereden RELEASE_MS_SLOW.
            durationByChannel[snapshotKey] = SLOW_RELEASE_CHANNELS.has(snapshotKey) ? RELEASE_MS_SLOW : RELEASE_MS_FAST
          }
        }
        if (Object.keys(snapshot).length > 0) {
          this._releaseStates.set(nodeId, {
            channels: snapshot,
            startedAtMs: performance.now(),
            durationByChannel,
          })
          console.log(`[WAVE-6020.9-SURVIVAL] clearManualOverride ${nodeId}: snapshotKeys=[${Object.keys(snapshot).join(',')}] pan=${snapshot['pan']?.toFixed(4) ?? 'N/A'} tilt=${snapshot['tilt']?.toFixed(4) ?? 'N/A'}`)
        }
      }
    }
    this._manualOverrides.delete(nodeId)
    // WAVE 4984 Paso 2: NO borrar _motorKineticOverrides aquí.
    // WAVE 4935 M2 lo hacía como "Ghost Anchor fix", pero causa amnesia IK:
    // apagar un patrón (clearManualOverride) borraba el target espacial IK,
    // de modo que al reactivar el patrón, ikPan/ikTilt eran undefined y el
    // fallback era anchorPan=0.5 → foco pierde su target y se va al centro.
    // Regla de Oro: _motorKineticOverrides SOLO se limpia desde clearMotorKineticOverride,
    // que es llamado exclusivamente por releaseSpatialTarget (botón Unlock del operador)
    // y removeNodes (cuando el engine elimina la pista por completo).
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

  /**
   * MANUAL PATTERN LOCK API.
   * setManualPattern (IPC) registra los nodeIds antes de activar el motor L2.
   * clearManualOverride respeta el lock: preserva pan_base/tilt_base.
   * release/hold branches del IPC handler eliminan el lock.
   */
  setManualPatternLock(nodeIds: readonly NodeId[]): void {
    for (let i = 0; i < nodeIds.length; i++) {
      this._manualPatternLocks.add(nodeIds[i])
    }
  }

  clearManualPatternLock(nodeId: NodeId): void {
    this._manualPatternLocks.delete(nodeId)
  }

  clearAllManualPatternLocks(): void {
    this._manualPatternLocks.clear()
  }

  hasManualPatternLock(nodeId: NodeId): boolean {
    return this._manualPatternLocks.has(nodeId)
  }

  /**
   * WAVE 4916: Lectura del override del motor cinético (IK puro o motor pattern).
   * Devuelve `{ pan_base, tilt_base }` si el fixture tiene un Spatial Target IK
   * activo. Usado por `setManualPattern` para preservar la posición IK como
   * anchor cuando el operador activa un patrón sobre un fixture ya apuntando
   * a un target 3D — evita el snap destructivo a (0.5, 0.5).
   */
  getMotorKineticOverride(nodeId: NodeId): Readonly<Record<string, number>> | undefined {
    return this._motorKineticOverrides.get(nodeId)
  }

  clearAllMotorKineticOverrides(): void {
    this._motorKineticOverrides.clear()
  }

  /** WAVE 7172: Registra nodos cuya base IK debe ser suprimida este frame. */
  setSpatialSuppression(nodeIds: ReadonlySet<string>): void {
    for (const id of nodeIds) {
      this._spatialSuppressedNodes.add(id)
    }
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

  /** WAVE 6020.8: Indica si hay un fade de retorno activo para este nodeId. */
  hasReleaseFade(nodeId: NodeId): boolean {
    return this._releaseStates.has(nodeId)
  }

  setEffectIntents(intents: readonly INodeIntent[]): void {
    this._effectIntents = intents
  }

  setHephaestusIntents(intents: readonly INodeIntent[]): void {
    this._hephaestusIntents = intents
  }

  /** WAVE 7120: L3++ Calibration — inject intents at highest priority pre-Blackout. */
  setCalibrationIntents(intents: readonly INodeIntent[]): void {
    this._calibrationIntents = intents
    this._calibrationLastInjectMs = Date.now()
    if (this._calibrationWatchdog) clearTimeout(this._calibrationWatchdog)
    this._calibrationWatchdog = setTimeout(() => {
      if (Date.now() - this._calibrationLastInjectMs >= 500) {
        this._calibrationIntents = []
        console.warn('[NodeArbiter 🎛️ CALIB] Watchdog: auto-clear after 500ms timeout')
      }
    }, 600)
  }

  /** WAVE 7120: Clear calibration bus (toggle OFF). */
  clearCalibrationIntents(): void {
    this._calibrationIntents = []
    if (this._calibrationWatchdog) {
      clearTimeout(this._calibrationWatchdog)
      this._calibrationWatchdog = null
    }
  }

  /**
   * WAVE 7110-B — Registra el bus de L1 de Chronos.
   * Llamado una vez durante la inicialización del motor.
   * El bus se limpia y rellena cada frame antes de arbitrate().
   */
  setChronosBus(bus: IIntentBus): void {
    this._chronosBus = bus
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
    this._opaqueNodeChannels.clear()
    this._opaqueChronosChannels.clear()
    this._l3DominatedChannels.clear()

    // WAVE 4752: SMART GATE — pre-computar canales tocados por L2/Chronos por nodo.
    // Sustituye el fixture-wide opaque mask de WAVE 4775.
    // L0/L1 solo bloqueados en los canales exactos que L2/Chronos están escribiendo.
    this._channelSetCursor = 0
    this._opaqueNodeChannels.clear()
    this._opaqueChronosChannels.clear()
    // WAVE 4829: ABSOLUTE L3 OVERRIDE — limpiar mapa de dominación L3 del frame anterior.
    this._l3DominatedChannels.clear()
    // WAVE 4918.5: limpiar nodos Hephaestus-color silenciadores de L0
    this._l3HephColorNodeIds.clear()
    // WAVE 7172: limpiar supresión IK espacial del frame anterior
    this._spatialSuppressedNodes.clear()

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

    // Chronos L1: registrar canales tocados por nodo
    if (this._chronosBus !== null) {
      const chronosCount = this._chronosBus.count
      for (let i = 0; i < chronosCount; i++) {
        const intent = this._chronosBus.getAt(i)
        let set = this._opaqueChronosChannels.get(intent.nodeId)
        if (!set) {
          set = this._acquireChannelSet()
          this._opaqueChronosChannels.set(intent.nodeId, set)
        }
        for (const key in intent.values) {
          const v = (intent.values as Record<string, number>)[key]
          if (typeof v === 'number' && Number.isFinite(v)) set.add(key)
        }
      }
    }

    // WAVE 4713 COMPAT: dimmer fixture tracking sigue activo para bloquear
    // intents de familia completa (kinetic/atmosphere pasan igual).
    this._manualDimmerFixtureIds.clear()
    for (const [nodeId, channels] of this._manualOverrides) {
      const manualDimmer = (channels as Record<string, number>)['dimmer']
      if (!isFiniteChannelValue(manualDimmer)) continue
      const sep = nodeId.lastIndexOf(':')
      if (sep <= 0) continue
      const family = nodeId.slice(sep + 1)
      if (FIXTURE_DIMMER_LOCK_EXEMPT_FAMILIES.has(family)) continue
      this._manualDimmerFixtureIds.add(nodeId.slice(0, sep))
    }

    // ⚡ WAVE 4917: L3 DOMINANCE PRE-PASS.
    // Construir el mapa de dominación ANTES de aplicar L0/L1 para que
    // el blindaje intra-frame sea real (L0 no llega a escribir lo que L3
    // ya reclama en effect/hephaestus durante este mismo arbitrate()).
    this._primeL3DominancePrePass()

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

    // L1: Chronos (WAVE 7110-B — fused into L1 alongside Selene)
    // Same priority layer. Both sources can write; LTP per channel.
    if (this._chronosBus !== null) {
      const chronosCount = this._chronosBus.count
      for (let i = 0; i < chronosCount; i++) {
        this._applyIntent(this._chronosBus.getAt(i), 'chronos')
      }
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
        if (key === 'tilt') {
          record[key] = Math.max(TILT_ARBITER_MIN, Math.min(incoming, TILT_ARBITER_MAX))
        } else {
          record[key] = incoming
        }
      }
    }

    // L3: Effect intents (WAVE 4705 — autoridad sobre L2 manual)
    // WAVE 4829: Se aplica ANTES de L2 en el flujo de datos internos para
    // poder registrar dominación. El MANUAL HARD LOCK sigue siendo la
    // autoridad final del operador humano (paso post-L3 abajo).
    for (let i = 0; i < this._effectIntents.length; i++) {
      this._applyIntent(this._effectIntents[i], 'effect')
    }

    // L3+: Hephaestus custom intents (Diamond Data direct curves)
    for (let i = 0; i < this._hephaestusIntents.length; i++) {
      this._applyIntent(this._hephaestusIntents[i], 'hephaestus')
    }

    // L3++: Calibration intents (Live Calibration Mode — Hephaestus Canvas direct injection)
    // Dominancia absoluta sobre todas las capas inferiores por LTP.
    // No requiere pausar TimelineEngine ni ningún motor — machaca por orden de escritura.
    for (let i = 0; i < this._calibrationIntents.length; i++) {
      this._applyIntent(this._calibrationIntents[i], 'calibration')
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

    // ⚡ WAVE 4914 — RELATIVE OFFSET FUSION (L2 Base + L0 Offset).
    // Sustituye al antiguo pin absoluto del L2-MOTOR. Para cada nodo:
    //   pan_final  = clamp01(pan_base  + pan_offset  * amp * aspect * dist_k)
    //   tilt_final = clamp01(tilt_base + tilt_offset * amp * aspect * dist_k)
    // Cuando no hay base, fallback a 0.5 (centro neutro → mapeo legacy).
    // Cuando no hay offset, fallback a 0 (base pura sin órbita).
    this._applyRelativeOffsetFusion()

    // WAVE 4984 Paso 1a: RELEASE FADES — interpolación ease-out al soltar overrides.
    // Se aplica DESPUÉS de _applyRelativeOffsetFusion para que el blend compare
    // el snapshot del manual contra el valor ya fusionado y clampeado (TILT_ARBITER_MAX).
    // Antes (WAVE 4752) corría antes de la fusión: el fade degradaba hacia 0 cuando
    // L0 no había escrito 'tilt', enviando el mover al techo en ceiling mounts.
    if (this._releaseStates.size > 0) {
      this._applyReleaseFades()
    }

    return this._result as ArbitratedNodeMap
  }

  /**
   * WAVE 4914 — RELATIVE OFFSET FUSION.
   *
   * Mezclador aditivo final: combina la base estática del IK / radar (L2)
   * con el offset orbital del VMM (L0). Sustituye al gate de exclusión del
   * antiguo bloque L2-MOTOR.
   *
   * Fórmula por canal:
   *   final = clamp01(base + offset * amp * aspect * distScale * gimbalFactor)
   *
   * Donde:
   *   base       = motor.pan_base ∥ manual.pan_base ∥ 0.5 (centro neutro)
   *   offset     = record.pan_offset ∥ 0 (sin órbita)
   *   amp        = this._relativeOffsetAmplitude (slider del Programmer)
   *   aspect     = RELATIVE_OFFSET_SCALE_PAN (0.5 — preserva legacy)
   *   distScale  = this._spatialDistanceScales[nodeId] ∥ 1.0
   *   gimbalFactor = solo en pan, atenuado cuando tilt_base ≈ 0.5
   *
   * INVARIANTE: cero alloc. Solo aritmética + lookups O(1) en Maps existentes.
   */
  private _applyRelativeOffsetFusion(): void {
    const amp = this._relativeOffsetAmplitude
    const ampPan  = amp * RELATIVE_OFFSET_SCALE_PAN
    const ampTilt = amp * RELATIVE_OFFSET_SCALE_TILT
    const intentsByFixture = Object.fromEntries(this._result)

    // Tracker para telemetría throttled.
    let sampleNodeId: string | null = null
    let samplePan = 0
    let sampleTilt = 0
    let samplePanOffset = 0
    let sampleTiltOffset = 0
    let sampleBasePan = 0
    let sampleBaseTilt = 0
    let fusionCount = 0

    // Garantizar que cualquier nodo con base IK/motor pero sin L0 offset
    // siga presente en _result (el VMM puede no haber emitido para él).
    for (const [nodeId] of this._motorKineticOverrides) {
      if (!this._result.has(nodeId)) {
        this._result.set(nodeId, this._acquireRecord())
      }
    }

    for (const [nodeId, record] of this._result) {
      const panOffset  = record['pan_offset']
      const tiltOffset = record['tilt_offset']
      const hasPanOffset  = isFiniteChannelValue(panOffset)
      const hasTiltOffset = isFiniteChannelValue(tiltOffset)

      const manual = this._manualOverrides.get(nodeId)

      // Motor override (AetherKineticEngine live output) — pan_base/tilt_base
      // with the moving pattern. Manual override has the static radar anchor.
      // Motor takes priority: when the engine is active, the fixture must move
      // with the motor output, not freeze at the manual anchor.
      const motor = this._motorKineticOverrides.get(nodeId)
      const motorPan  = motor ? motor['pan_base']  : undefined
      const motorTilt = motor ? motor['tilt_base'] : undefined
      const hasMotorPan  = isFiniteChannelValue(motorPan)
      const hasMotorTilt = isFiniteChannelValue(motorTilt)

      const manualPan  = manual ? manual['pan_base']  : undefined
      const manualTilt = manual ? manual['tilt_base'] : undefined

      const hasManualPan  = isFiniteChannelValue(manualPan)
      const hasManualTilt = isFiniteChannelValue(manualTilt)
      const hasBasePan  = hasMotorPan  || hasManualPan
      const hasBaseTilt = hasMotorTilt || hasManualTilt

      // Skip nodos sin base ni offset — no son cinéticos en este frame.
      if (!hasBasePan && !hasBaseTilt && !hasPanOffset && !hasTiltOffset) {
        continue
      }

      // WAVE 4933.2: L2 ABSOLUTE SUPREMACY.
      // Si _manualOverrides tiene pan/tilt ABSOLUTO (radar touch sin patrón)
      // pero NO pan_base/tilt_base (que indicaría modo órbita con patrón activo),
      // el offset de L0 (VMM automático) se descarta por completo.
      // Los valores absolutos ya están en el record desde _applyIntent('manual').
      // Doctrina: tocar el radar = congelación total de la automatización L0.
      const manualAbsPan  = manual ? manual['pan']  : undefined
      const manualAbsTilt = manual ? manual['tilt'] : undefined
      const hasAbsoluteManualLock =
        (isFiniteChannelValue(manualAbsPan)  && !hasManualPan)  ||
        (isFiniteChannelValue(manualAbsTilt) && !hasManualTilt)
      if (hasAbsoluteManualLock) continue

      const sep = nodeId.indexOf(':')
      const fixtureId = sep >= 0 ? nodeId.slice(0, sep) : nodeId

      // [WAVE 4936] RADAR TELEMETRY TRAP
      if (manual && (manual['pan'] !== undefined || manual['pan_base'] !== undefined)) {
        // Filtramos para loguear solo un fixture y evitar spam en consola
        if (fixtureId === Object.keys(intentsByFixture)[0]) { 
          console.warn(`[ARBITER DIAG] Fixture: ${fixtureId}`, {
            payload_pan: manual['pan'],
            payload_base: manual['pan_base'],
            hasManualPan: hasManualPan,
            isHoldActive: (!hasManualPan && !hasManualTilt)
          });
        }
      }

      // WAVE 4934 M1: HOLD STATE DETECTION.
      // HOLD = motor inactive (no pan_base/tilt_base in _motorKineticOverrides)
      // but manual has pan_base/tilt_base (radar anchor). The fixture must freeze
      // at the anchor. When the motor IS active (sweep, circle, etc.), the motor's
      // pan_base/tilt_base has the live pattern output and isHoldState must be false.
      const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt
      if (isHoldState) {
        if (hasManualPan && !isFiniteChannelValue(manualAbsPan)) record['pan'] = manualPan as number
        if (hasManualTilt && !isFiniteChannelValue(manualAbsTilt)) {
          const clampedTilt = Math.max(TILT_ARBITER_MIN, Math.min(manualTilt as number, TILT_ARBITER_MAX))
          record['tilt'] = clampedTilt
        }
        continue
      }

      // Base resolver — motor (live pattern) takes priority over manual (static anchor).
      // When motor is active, basePan/baseTilt = motor output (moving).
      // When motor is inactive, basePan/baseTilt = manual anchor (for offset fusion).
      const basePan  = hasMotorPan  ? (motorPan  as number) : (hasManualPan  ? (manualPan  as number) : 0.5)
      const baseTilt = hasMotorTilt ? (motorTilt as number) : (hasManualTilt ? (manualTilt as number) : 0.5)

      // Escala por distancia (WAVE 4914 §3.2) — default 1.0 si no se configuró.
      const distScale = this._spatialDistanceScales.get(nodeId) ?? 1.0

      // ── Gimbal Lock fade sobre pan_offset ──────────────────────────
      // Cuando baseTilt ≈ 0.5 (haz cenital/nadiral), pan_offset rota la
      // carcasa sin mover el haz visualmente. Atenuar a 0 en la zona muerta
      // y crecer linealmente hasta 1 fuera de la banda de fade.
      let gimbalFactor = 1
      if (hasBaseTilt) {
        const tiltDist = baseTilt - GIMBAL_TILT_CENTER
        const tiltDistAbs = tiltDist < 0 ? -tiltDist : tiltDist
        gimbalFactor = tiltDistAbs >= GIMBAL_TILT_FADE_HALFWIDTH
          ? 1
          : tiltDistAbs / GIMBAL_TILT_FADE_HALFWIDTH
      }

      // ── Fusión aditiva — WAVE 4980: LTP SUPPRESSION + hard tilt cap ────────
      // REGLA LTP: si L2 tiene base activa, el offset L0 (VMM) se anula.
      // El operador está apuntando con IK; el patrón automático NO puede
      // sumar grados encima. Cuando no hay base L2, el offset fluye normal
      // (degeneración al comportamiento legacy orbit-around-0.5).
      if (hasBasePan || hasPanOffset) {
        const ox = (!hasBasePan && hasPanOffset) ? (panOffset as number) : 0
        let final = basePan + ox * ampPan * distScale * gimbalFactor
        if (final < 0) final = 0
        else if (final > 1) final = 1
        record['pan'] = final
      }
      if (hasBaseTilt || hasTiltOffset) {
        const oy = (!hasBaseTilt && hasTiltOffset) ? (tiltOffset as number) : 0
        let final = baseTilt + oy * ampTilt * distScale
        // WAVE 4988 Paso 2: Clamp bilateral — protege suelo (MAX) y techo (MIN).
        if (final < TILT_ARBITER_MIN) final = TILT_ARBITER_MIN
        else if (final > TILT_ARBITER_MAX) final = TILT_ARBITER_MAX
        record['tilt'] = final
      }

      fusionCount++
      if (sampleNodeId === null && (hasBasePan || hasBaseTilt) && (hasPanOffset || hasTiltOffset)) {
        sampleNodeId = nodeId
        samplePan  = record['pan']  ?? basePan
        sampleTilt = record['tilt'] ?? baseTilt
        samplePanOffset  = hasPanOffset  ? (panOffset  as number) : 0
        sampleTiltOffset = hasTiltOffset ? (tiltOffset as number) : 0
        sampleBasePan  = basePan
        sampleBaseTilt = baseTilt
      }
    }

    // Telemetría throttled — confirma que la fusión está viva en producción.
    this._fusionLogCounter++
    if (this._fusionLogCounter >= RELATIVE_FUSION_LOG_EVERY_FRAMES && sampleNodeId !== null) {
      this._fusionLogCounter = 0
      console.log(
        `[NodeArbiter ⚡ WAVE-4914] fusion=${fusionCount} amp=${amp.toFixed(2)} ` +
        `sample[${sampleNodeId}] base=(${sampleBasePan.toFixed(3)},${sampleBaseTilt.toFixed(3)}) ` +
        `offset=(${samplePanOffset.toFixed(3)},${sampleTiltOffset.toFixed(3)}) ` +
        `→ final=(${samplePan.toFixed(3)},${sampleTilt.toFixed(3)})`
      )
    }
  }

  // ── WAVE 4914 PUBLIC API ─ RELATIVE OFFSET CONTROL ─────────────────────

  /**
   * WAVE 4914: Setter de la amplitud global del offset relativo.
   * Llamado por AetherIPCHandlers cuando el slider de Amplitude del
   * Programmer cambia. Rango [0, 2.0] (>1 sobrepasa el envelope pero el
   * clamp01 del fusion lo recorta).
   */
  setRelativeOffsetAmplitude(value: number): void {
    if (!Number.isFinite(value)) return
    this._relativeOffsetAmplitude = value < 0 ? 0 : value > 2 ? 2 : value
  }

  /** WAVE 4914: lectura del valor actual de amplitud (telemetría / UI sync). */
  getRelativeOffsetAmplitude(): number {
    return this._relativeOffsetAmplitude
  }

  /**
   * WAVE 4914: Setter de la escala de distancia para un nodo.
   * Pre-computado por AetherIPCHandlers.applySpatialTarget — una vez por
   * target update, NO por frame. Mantiene el arco visual del patrón VMM
   * aproximadamente constante para fixtures cercanos y lejanos al objetivo.
   *
   * @param nodeId   NodeId formato `${fixtureId}:kinetic`
   * @param scale    [0.25, 2.0]. Default implícito 1.0 si no se setea.
   */
  setSpatialDistanceScale(nodeId: NodeId, scale: number): void {
    if (!Number.isFinite(scale)) return
    const clamped = scale < 0.25 ? 0.25 : scale > 2 ? 2 : scale
    this._spatialDistanceScales.set(nodeId, clamped)
  }

  /** WAVE 4914: limpia la escala de distancia de un nodo. */
  clearSpatialDistanceScale(nodeId: NodeId): void {
    this._spatialDistanceScales.delete(nodeId)
  }

  /** WAVE 4914: limpia todas las escalas de distancia (release total). */
  clearAllSpatialDistanceScales(): void {
    this._spatialDistanceScales.clear()
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
    // L0/L1 solo bloqueados en canales que L2/Chronos están tocando EN ESE NODO.
    const l2BlockedChannels = (layer === 'system' || layer === 'selene')
      ? this._opaqueNodeChannels.get(intent.nodeId)
      : undefined
    const chronosBlockedChannels = (layer === 'system' || layer === 'selene')
      ? this._opaqueChronosChannels.get(intent.nodeId)
      : undefined
    // WAVE 4829: ABSOLUTE L3 OVERRIDE — canales dominados por L3 en este frame.
    // L0/L1 no pueden escribir canales que L3 ya reclamó — zero blend.
    const l3DominatedChannels = (layer === 'system' || layer === 'selene')
      ? this._l3DominatedChannels.get(intent.nodeId)
      : undefined

    const values = intent.values
    const shieldedColorNode =
      layer === 'selene' &&
      !this._seleneOverrideMoverShield &&
      this._moverShieldNodeIds.has(intent.nodeId)

    // WAVE 4918.5: Si L0 quiere escribir a un nodo que Hephaestus (L3) ya
    // reclamó con color, L0 calla completamente. La rueda de color física del
    // mover es propiedad exclusiva del efecto en este frame.
    if (layer === 'system' && this._l3HephColorNodeIds.has(intent.nodeId)) {
      return
    }

    // 🌊 WAVE 4836 — L3 SUPREMACY ABSOLUTA (Doctrina sellada en WAVE-4835):
    // Cuando L3 escribe un canal, L0/L1 callan en ese canal de ese nodo.
    // El campo `intent.mergeStrategy` queda preservado en los tipos para
    // arbitraje intra-L3 futuro (varios efectos L3 simultáneos), pero a
    // nivel inter-capas siempre es LTP. Esto restaura el carácter de los
    // efectos blandos (CumbiaMoon, CorazonLatino) — antes HTP per-canal
    // de WAVE 4832 los hacía perder ante L0 en un entorno musical activo.
    for (const channel in values) {
      // MoverShield: bloquea canales de color en L1 para movers con rueda física
      if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
        continue
      }

      // WAVE 4752: SMART GATE — bloqueo per-canal-tocado.
      // L0/L1 no pueden escribir un canal si L2 o Chronos lo están escribiendo
      // en ESTE NODO específico. Canales no tocados por L2/Chronos fluyen libres.
      if ((l2BlockedChannels?.has(channel) === true ||
           chronosBlockedChannels?.has(channel) === true)) {
        continue
      }
      // WAVE 4829: ABSOLUTE L3 OVERRIDE — L3 Supremacy.
      // Si L3 ya escribió este canal en este nodo, L0/L1 son silenciados.
      // Zero blend: el efecto de Selene se renderiza puro, sin sangrado físico.
      if (l3DominatedChannels?.has(channel) === true) {
        continue
      }

      // WAVE 6020.3 FIX: L0 FREEZE durante release fade.
      // Si este nodo está soltando un override (release fade en progreso),
      // L0 NO escribe pan/tilt. El fade interpola snapshot → snapshot
      // (posición congelada), evitando que el patrón VMM arrastre al
      // fixture durante el fade-out post-Unlock.
      if (layer === 'system' && this._releaseStates.has(intent.nodeId)) {
        if (channel === 'pan' || channel === 'tilt') {
          continue
        }
      }

      const incoming = values[channel]
      if (!isFiniteChannelValue(incoming)) {
        continue
      }

      // WAVE 4829 + 🌊 WAVE 4836: Registrar dominación L3 para el Escudo Anti-Sangrado.
      // L3 SIEMPRE domina los canales que escribe — sin ramas HTP de coexistencia.
      // Los efectos blandos (CumbiaMoon/CorazonLatino) cargan su propio dimmer
      // (peakIntensity/heartIntensity) y no necesitan a L0 como soporte.
      if (layer === 'effect' || layer === 'hephaestus' || layer === 'calibration') {
        this._registerL3Dominance(intent.nodeId, channel)
        // WAVE 4918.5: Si Hephaestus/L3++ escribe color a este nodo, marcarlo para
        // bloquear L0 completamente (silencio total en ese nodo este frame).
        if ((layer === 'hephaestus' || layer === 'calibration') && (
          channel === 'r' || channel === 'g' || channel === 'b' ||
          channel === 'red' || channel === 'green' || channel === 'blue' ||
          channel === 'colorWheel' || channel === 'color_wheel'
        )) {
          this._l3HephColorNodeIds.add(intent.nodeId)
        }
      }

      if (STRICT_PRIORITY_CHANNELS.has(channel)) {
        // strobe/shutter: PRIORIDAD ESTRICTA POR CAPA.
        // Excepción: L3 (effect) con dimmer=0 tiene autoridad destructiva (WAVE 4705).
        if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
          record[channel] = 0
          continue
        }
        // L3+ (hephaestus) y L3++ (calibration) tienen autoridad total sobre todos los canales.
        if (layer === 'hephaestus' || layer === 'calibration') {
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
        // 🌊 WAVE 4836: LTP universal entre capas.
        // La última escritura (capa más alta) gana. L3 ya bloqueó L0/L1
        // arriba vía _l3DominatedChannels, y L2/LP via Smart Gate.
        // Nota: `intent.mergeStrategy` se preserva en el tipo para futuro
        // arbitraje intra-L3 (varios efectos L3 escribiendo el mismo canal).
        record[channel] = incoming
      }
    }
  }

  /**
   * ⚡ WAVE 4917: Pre-carga dominación L3 desde los intents ya presentes
   * en este frame. Esto permite bloquear L0/L1 desde el inicio del arbitraje.
   */
  private _primeL3DominancePrePass(): void {
    for (let i = 0; i < this._effectIntents.length; i++) {
      const intent = this._effectIntents[i]
      const values = intent.values
      for (const channel in values) {
        const incoming = values[channel]
        if (!isFiniteChannelValue(incoming)) continue
        this._registerL3Dominance(intent.nodeId, channel)
      }
    }

    for (let i = 0; i < this._hephaestusIntents.length; i++) {
      const intent = this._hephaestusIntents[i]
      const values = intent.values
      for (const channel in values) {
        const incoming = values[channel]
        if (!isFiniteChannelValue(incoming)) continue
        this._registerL3Dominance(intent.nodeId, channel)
        // WAVE 4918.5: marcar el nodo para silenciar L0 completamente si Hephaestus escribe color
        if (
          channel === 'r' || channel === 'g' || channel === 'b' ||
          channel === 'red' || channel === 'green' || channel === 'blue' ||
          channel === 'colorWheel' || channel === 'color_wheel'
        ) {
          this._l3HephColorNodeIds.add(intent.nodeId)
        }
      }
    }

    // L3++: Calibration — registrar dominancia antes de L0/L1
    for (let i = 0; i < this._calibrationIntents.length; i++) {
      const intent = this._calibrationIntents[i]
      const values = intent.values
      for (const channel in values) {
        const incoming = values[channel]
        if (!isFiniteChannelValue(incoming)) continue
        this._registerL3Dominance(intent.nodeId, channel)
        if (
          channel === 'r' || channel === 'g' || channel === 'b' ||
          channel === 'red' || channel === 'green' || channel === 'blue' ||
          channel === 'colorWheel' || channel === 'color_wheel'
        ) {
          this._l3HephColorNodeIds.add(intent.nodeId)
        }
      }
    }
  }

  /**
   * Registra dominación L3 por canal + aplica el gag de luminancia cross-family.
   * Reutilizado por pre-pass y por el flujo normal de _applyIntent.
   */
  private _registerL3Dominance(nodeId: string, channel: string): void {
    let dominated = this._l3DominatedChannels.get(nodeId)
    if (!dominated) {
      dominated = this._acquireChannelSet()
      this._l3DominatedChannels.set(nodeId, dominated)
    }
    dominated.add(channel)

    // ⚡ WAVE 4871 + WAVE 4917: L3 LUMINANCE GAG.
    // Si L3 escribe en :impact o :color, dominar también luminancia
    // en ambos nodos del fixture para apagar sangrado L0/L1.
    const sep = nodeId.lastIndexOf(':')
    if (sep <= 0) return
    const family = nodeId.slice(sep + 1)
    if (!L3_GAG_TRIGGER_FAMILIES.has(family)) return

    const fixturePrefix = nodeId.slice(0, sep)
    for (const gagFamily of L3_GAG_TRIGGER_FAMILIES) {
      const gagNodeId = `${fixturePrefix}:${gagFamily}`
      let gagDominated = this._l3DominatedChannels.get(gagNodeId)
      if (!gagDominated) {
        gagDominated = this._acquireChannelSet()
        this._l3DominatedChannels.set(gagNodeId, gagDominated)
      }
      for (const lumCh of L3_LUMINANCE_GAG_CHANNELS) {
        gagDominated.add(lumCh)
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
    this._manualPatternLocks.clear()
  }

  /**
   * PARCHE 4 — ARMED LOCK: Purga completa de estado obsoleto al cargar un show.
   *
   * Llamado por TitanOrchestrator.setFixtures() DESPUÉS de que el grafo Aether
   * ha sido reconstruido. En ese momento todos los nodeIds del show anterior
   * son inválidos: _manualOverrides, _moverShieldNodeIds e _inhibitLimits
   * pueden contener refs a nodos que ya no existen, causando escrituras a
   * canales huérfanos o bloqueos fantasma en el siguiente arbitrate().
   *
   * NO borra _effectIntents, _hephaestusIntents ni _chronosBus porque
   * esos arrays son sobreescritos cada frame por el pipeline.
   * NO toca _grandMaster ni _blackout — son state del operador, no del show.
   */
  purgeForShow(): void {
    this._manualOverrides.clear()
    this._motorKineticOverrides.clear()
    this._releaseStates.clear()
    this._manualPatternLocks.clear()
    this._moverShieldNodeIds.clear()
    this._inhibitLimits.clear()
    this._calibrationIntents = []
    if (this._calibrationWatchdog) {
      clearTimeout(this._calibrationWatchdog)
      this._calibrationWatchdog = null
    }
    console.log('[NodeArbiter] 🧹 purgeForShow: stale L2 node refs + L3++ calibration cleared for new show')
  }

  /**
   * WAVE 4529: Lista los nodeIds que tienen overrides manuales activos.
   * Útil para debug/telemetría.
   */
  getManualOverrideNodeIds(): readonly string[] {
    const out = this._manualOverrideNodeIdsScratch
    out.length = 0
    for (const key of this._manualOverrides.keys()) {
      out.push(key)
    }
    return out
  }

  // ── Inhibit Limit API (WAVE 4531) ─────────────────────────────────────────────────────

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

  /** Zero-alloc Set pool para _opaqueNodeChannels / _opaqueChronosChannels */
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
      // WAVE 6019.5 FIX: Si el nodo no está en _result (L0 aún no emitió),
      // crear un registro vacío para que el fade no aborte. Sin esto, el
      // nodo desaparece del output y el resolver envía DMX 0 → techo.
      if (!record) {
        record = {}
        this._result.set(nodeId, record)
      }

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
        // WAVE 6019.5 FIX: Si L0 aún no escribió este canal, usar el valor
        // del snapshot como fallback. Esto congela el foco en su última
        // posición conocida en lugar de degradar a 0 (techo).
        // WAVE 6020.4: Para pan/tilt, IGNORAR completamente cualquier valor
        // L0 previo en _result (del frame anterior al fade). El gate L0 freeze
        // (WAVE 6020.3) bloquea nuevas escrituras, pero el valor que ya
        // existía en _result seguiría arrastrando al fixture. Forzando
        // l0Value = releaseValue, el fade es estático: snapshot → snapshot.
        const l0Value = (key === 'pan' || key === 'tilt')
          ? releaseValue
          : (record[key] ?? releaseValue)
        if (l0Value !== undefined && Number.isFinite(l0Value)) {
          // Blend: snapshot del manual → valor L0 ya fusionado + clampeado
          let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
          // WAVE 4988 Paso 2: Guardia dual — el blend no puede salir del rango físico
          // del tilt en ningún sentido (ni suelo ni techo).
          // WAVE 6020.3: El L0 ya no escribe pan/tilt durante release fade
          // (gate en _applyIntent), así que l0Value === releaseValue y el
          // fixture permanece congelado en la posición del snapshot.
          if (key === 'tilt') blended = Math.max(TILT_ARBITER_MIN, Math.min(blended, TILT_ARBITER_MAX))
          record[key] = blended
        }
      }

      if (fadeCompleted) {
        this._releaseStates.delete(nodeId)
        console.log(`[WAVE-6020.9-SURVIVAL] Fade COMPLETED for ${nodeId} — purge code executing`)
        // WAVE 6020.8: Purgar pan_base/tilt_base del manual override al terminar el fade.
        // Si setManualOverrides inyectó valores desde espacio IK (ej. tilt_base=0.698
        // para un ceiling fixture), la fusión post-fade oscila alrededor de ese base
        // incorrecto → mitad del ciclo VMM apunta al techo.
        // Borrando estas keys, la fusión cae al default 0.5 y el offset ceiling
        // (TILT_OFFSET_CEILING=-0.325) centra el patrón en la semiesfera inferior.
        const manual = this._manualOverrides.get(nodeId)
        if (manual) {
          const mutable = manual as Record<string, number>
          const hadPanBase = 'pan_base' in mutable
          const hadTiltBase = 'tilt_base' in mutable
          if (hadPanBase) delete mutable['pan_base']
          if (hadTiltBase) delete mutable['tilt_base']
          console.log(`[WAVE-6020.9-SURVIVAL] Purged manual for ${nodeId}: hadPanBase=${hadPanBase} hadTiltBase=${hadTiltBase} keysLeft=${Object.keys(mutable).length}`)
          if (Object.keys(mutable).length === 0) {
            this._manualOverrides.delete(nodeId)
          }
        }
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
