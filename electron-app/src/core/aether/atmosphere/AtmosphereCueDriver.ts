/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️🚨 AETHER MATRIX — ATMOSPHERE CUE DRIVER (WAVE 7737 — THE QUARANTINE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reemplaza `adapters/AtmosphereAdapter.ts` como el driver de la familia
 * ATMOSPHERE. A diferencia de su predecesor (que corría a 44Hz y escribía
 * al bus L0), este driver:
 *
 *   RING 1 — NUNCA escribe al bus L0 (`_aetherBus`). Escribe al bus L3
 *   (`_effectBus`), de modo que el Manual Hard Lock del NodeArbiter (L2)
 *   siempre puede vetar sus intents — el operador es soberano sobre humo
 *   y fuego, nunca la IA. Ver TitanOrchestrator/TickEngine — el call site
 *   pasa `this._effectBus` en lugar de `this._aetherBus`.
 *
 *   RING 2 — Corre la lógica fluídica (fog/haze/fan/custom) a 4Hz
 *   (`ATMOS_DIVIDER = 11` sobre un tick de 44Hz), no a 44Hz. La respuesta
 *   mecánica de una bomba de fluido es 200-500ms; 44Hz es 10x sobremuestreo
 *   que solo produce chatter de solenoide. Entre recomputes, el driver
 *   re-emite (hold) el último valor calculado — el Arbiter siempre
 *   encuentra un intent válido en cada frame.
 *
 *   RING 3 — Los canales `fire_valve`/`fire_ignite`/`emission_gate` NUNCA
 *   se derivan de audio/vibe/sección musical. El switch de `_recomputeFluid`
 *   ni siquiera los toca para `spark`/`pyro`/`laser`. El único camino legítimo
 *   es la API explícita de cue (`armEmission`, `setFireValve`, `pulseIgnition`),
 *   que un futuro handler IPC/operador/Chronos debe invocar. No existe ningún
 *   code path desde `FrameContext` (audio/musical/vibe) hacia estos 3 canales.
 *
 *   RING 4 — Deadman switch: si no llega un cue explícito en `DEADMAN_MS`,
 *   emission_gate/fire_valve/fire_ignite colapsan a 0 en el frame evaluado
 *   siguiente, y el estado armado se purga (requiere re-arme explícito).
 *
 * Los Gates 1 (cooldown) y 2 (overheat de fog) de `AtmosphereAdapter.ts`
 * se preservan verbatim para el path fluídico — la única diferencia es la
 * cadencia de evaluación (4Hz) y el destino del intent (L3, no L0).
 *
 * Ver docs/technical_audits/Aether_Agnostic_blueprint.md §3.3 (Rings 1-4).
 *
 * @module core/aether/atmosphere/AtmosphereCueDriver
 * @version WAVE 7737
 */

import { NodeFamily } from '../types'
import type { AtmosphereType } from '../types'
import type { IAtmosphereNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** L3 Effects range (300-399) — misma convención que SeleneAetherAdapter. */
const CUE_INTENT_PRIORITY = 300
const CUE_SOURCE = 'atmosphere-cue-driver'

/** WAVE 7737: 44Hz tick / 11 = 4Hz — la cadencia correcta para hardware fluídico. */
export const ATMOS_DIVIDER = 11

/**
 * WAVE 7737: DEADMAN — sin un cue explícito dentro de esta ventana,
 * emission_gate/fire_valve/fire_ignite colapsan a 0 y el arme se purga.
 * Pérdida de control = estado seguro, siempre.
 */
const DEADMAN_MS = 2000

// Gate 1: Cooldowns por tipo (ms) — idénticos a AtmosphereAdapter.ts (preservados).
const COOLDOWN_FOG_MS  = 5_000
const COOLDOWN_HAZE_MS = 2_000
const COOLDOWN_FAN_MS  =     0

// Gate 2: límite de activación continua para fog (evita sobrecalentamiento).
const FOG_MAX_CONTINUOUS_MS = 180_000

// Nivel base de haze (ambiente continuo, sin cooldown obligatorio).
const HAZE_BASE_LEVEL = 0.30
const HAZE_VIBE_SCALE = 0.40

// Output mínimo de fan (evita silencio total / mantiene disipación).
const FAN_MIN_OUTPUT = 0.10

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE CUE DRIVER
// ─────────────────────────────────────────────────────────────────────────────

export class AtmosphereCueDriver
  extends BaseSystem<IAtmosphereNodeData>
  implements IAetherSystem<IAtmosphereNodeData>
{
  readonly name = 'AtmosphereCueDriver'
  readonly family = NodeFamily.ATMOSPHERE
  readonly source: string = CUE_SOURCE

  // ── Decimación de frame (44Hz tick → 4Hz recompute) ───────────────────
  private _frameCounter = 0

  // ── Fluid state — Gate 1 (cooldown) + Gate 2 (fog overheat) ───────────
  private readonly _lastActivationMs = new Map<string, number>()
  private readonly _fogStartMs = new Map<string, number>()
  private readonly _fogOverheatCooldown = new Map<string, boolean>()
  private readonly _prevLevel = new Map<string, number>()

  // ── Cached output — reemitido (hold) entre recomputes de 4Hz ──────────
  private readonly _cachedPump = new Map<string, number>()
  private readonly _cachedDensity = new Map<string, number>()
  private readonly _cachedFan = new Map<string, number>()

  // ── WAVE 7737: SAFETY-CRITICAL CUE STATE (fire/emission) ──────────────
  // Estos 4 Maps son la ÚNICA fuente de verdad para fire_*/emission_gate.
  // NUNCA se escriben desde `_recomputeFluid` ni desde ningún dato de audio.
  private readonly _emissionArmed = new Map<string, boolean>()
  private readonly _fireValveTarget = new Map<string, number>()
  private readonly _ignitePulseUntilMs = new Map<string, number>()
  private readonly _lastCueMs = new Map<string, number>()

  constructor() {
    super()
    this._intentScratch.priority = CUE_INTENT_PRIORITY
    this._intentScratch.source = CUE_SOURCE
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXPLICIT CUE API — el ÚNICO camino legítimo hacia fire_*/emission_gate.
  // Invocar exclusivamente desde un IPC handler / acción de operador / cue
  // de Chronos. JAMÁS desde AudioMetrics, VibeProfile o MusicalContext.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Arma o desarma el interlock de emisión (láser Class 3B/4, etc).
   * El arme se purga automáticamente si el deadman expira sin refresco.
   */
  armEmission(nodeId: string, armed: boolean): void {
    this._emissionArmed.set(nodeId, armed)
    this._lastCueMs.set(nodeId, Date.now())
  }

  /**
   * Fija el objetivo de la válvula de combustible/fluido (0-1).
   * Requiere refresco continuo — el deadman lo colapsa a 0 sin cue.
   */
  setFireValve(nodeId: string, value: number): void {
    this._fireValveTarget.set(nodeId, value < 0 ? 0 : value > 1 ? 1 : value)
    this._lastCueMs.set(nodeId, Date.now())
  }

  /**
   * Dispara un pulso de ignición de `durationMs` (default 250ms).
   * El canal cae a 0 automáticamente al expirar — no requiere un
   * segundo comando explícito de "apagar".
   */
  pulseIgnition(nodeId: string, durationMs = 250): void {
    const now = Date.now()
    this._ignitePulseUntilMs.set(nodeId, now + (durationMs < 0 ? 0 : durationMs))
    this._lastCueMs.set(nodeId, now)
  }

  /** Query de diagnóstico — ¿cuánto falta para que el deadman expire? */
  getDeadmanRemainingMs(nodeId: string): number {
    const lastCue = this._lastCueMs.get(nodeId) ?? 0
    const remaining = DEADMAN_MS - (Date.now() - lastCue)
    return remaining > 0 ? remaining : 0
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOT PATH — llamado a 44Hz por TickEngine, recomputa internamente a 4Hz.
  // ═══════════════════════════════════════════════════════════════════════

  process(
    view: INodeView<IAtmosphereNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    this._frameCounter++
    const shouldRecompute = (this._frameCounter % ATMOS_DIVIDER) === 0
    const nowMs = context.nowMs

    view.forEach((node) => {
      const nodeId = node.nodeId

      // ── RING 2: recomputar la física fluídica solo cada 11 frames ─────
      if (shouldRecompute) {
        this._recomputeFluid(node, node.atmosType, context)
      }

      // ── Emitir SIEMPRE — hold del último valor computado/armado ───────
      // Las 6 keys se fijan incondicionalmente: `_valuesDict` es un objeto
      // compartido y reutilizado por push() (ver IntentBus.push() doc);
      // dejar una key sin asignar filtraría el valor del nodo anterior.
      this._valuesDict['smoke_pump'] = this._cachedPump.get(nodeId) ?? 0
      this._valuesDict['smoke_density'] = this._cachedDensity.get(nodeId) ?? 0
      this._valuesDict['fan_speed'] = this._cachedFan.get(nodeId) ?? 0

      // ── RING 3 + RING 4: SAFETY CHANNELS — deadman evaluado CADA frame ─
      // (no decimado — la ventana de 2s de gracia debe cerrarse con
      // precisión de frame, no con la granularidad de 4Hz del path fluídico).
      const lastCue = this._lastCueMs.get(nodeId) ?? 0
      const deadmanExpired = (nowMs - lastCue) > DEADMAN_MS

      const armed = !deadmanExpired && (this._emissionArmed.get(nodeId) ?? false)
      this._valuesDict['emission_gate'] = armed ? 1 : 0

      const valveTarget = deadmanExpired ? 0 : (this._fireValveTarget.get(nodeId) ?? 0)
      this._valuesDict['fire_valve'] = valveTarget

      const igniteUntil = this._ignitePulseUntilMs.get(nodeId) ?? 0
      const igniting = !deadmanExpired && nowMs < igniteUntil
      this._valuesDict['fire_ignite'] = igniting ? 1 : 0

      if (deadmanExpired) {
        // Purgar el estado armado — el próximo cue debe re-armar explícitamente.
        // Sin esto, un cue viejo "reviviría" instantáneamente si llegase
        // un refresco de `_lastCueMs` sin re-especificar el valor deseado.
        this._emissionArmed.set(nodeId, false)
        this._fireValveTarget.set(nodeId, 0)
      }

      this._intentScratch.nodeId = nodeId
      this._intentScratch.confidence = 1.0
      bus.push(this._intentScratch as INodeIntent)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLUID PHYSICS — recomputado a 4Hz. NUNCA toca fire_*/emission_gate.
  // ─────────────────────────────────────────────────────────────────────────

  private _recomputeFluid(
    node: IAtmosphereNodeData,
    atmosType: AtmosphereType,
    context: FrameContext,
  ): void {
    const nodeId = node.nodeId
    const { audio, musical, vibe, nowMs } = context

    // Gate global: cooldown de seguridad del nodo (compartido con telemetría L2 UI).
    if (node.safety.cooldownRemaining > 0) {
      this._cachedPump.set(nodeId, 0)
      this._cachedDensity.set(nodeId, 0)
      this._cachedFan.set(nodeId, FAN_MIN_OUTPUT)
      this._prevLevel.set(nodeId, 0)
      return
    }

    if (!this._lastActivationMs.has(nodeId)) {
      this._lastActivationMs.set(nodeId, 0)
      this._prevLevel.set(nodeId, 0)
    }

    let candidateLevel = 0
    let fanSpeed = 0

    switch (atmosType) {
      case 'fog': {
        const dropBoost = musical.section === 'drop' ? 0.30 : 0.0
        candidateLevel = BaseSystem.clamp01(musical.sectionIntensity * vibe.intensity + dropBoost)
        fanSpeed = BaseSystem.clamp01(audio.energy * vibe.movementSpeed)
        break
      }
      case 'haze': {
        candidateLevel = BaseSystem.clamp01(HAZE_BASE_LEVEL + vibe.intensity * HAZE_VIBE_SCALE)
        fanSpeed = BaseSystem.clamp01(0.4 * audio.energy)
        break
      }
      case 'fan': {
        fanSpeed = Math.max(FAN_MIN_OUTPUT, BaseSystem.clamp01(audio.energy * vibe.movementSpeed))
        this._cachedPump.set(nodeId, 0)
        this._cachedDensity.set(nodeId, 0)
        this._cachedFan.set(nodeId, fanSpeed)
        this._prevLevel.set(nodeId, fanSpeed)
        return
      }
      // 🚨 WAVE 7737: spark/pyro/laser — NUNCA computados desde audio.
      // Su único canal legítimo (emission_gate/fire_valve/fire_ignite) vive
      // fuera de este switch, gobernado exclusivamente por la API de cue
      // explícita en `process()`. `smoke_pump`/`smoke_density`/`fan_speed`
      // no aplican a estos tipos — se dejan en 0.
      case 'spark':
      case 'pyro':
      case 'laser': {
        candidateLevel = 0
        fanSpeed = 0
        break
      }
      case 'custom':
      default: {
        candidateLevel = atmosType === 'custom' ? vibe.intensity : 0
        fanSpeed = 0
        break
      }
    }

    // ── Gate 1: cooldown entre disparos ────────────────────────────────
    const prevLevel = this._prevLevel.get(nodeId)!
    const lastActMs = this._lastActivationMs.get(nodeId)!
    const cooldownMs = this._getCooldownMs(atmosType)
    const cooldownPassed = (nowMs - lastActMs) >= cooldownMs
    const isActivating = (prevLevel === 0) && (candidateLevel > 0)
    if (isActivating && !cooldownPassed) {
      candidateLevel = 0
    } else if (isActivating && cooldownPassed) {
      this._lastActivationMs.set(nodeId, nowMs)
    }

    // ── Gate 2: límite de tiempo continuo para fog (sobrecalentamiento) ─
    if (atmosType === 'fog') {
      if (!this._fogStartMs.has(nodeId)) {
        this._fogStartMs.set(nodeId, 0)
        this._fogOverheatCooldown.set(nodeId, false)
      }
      const fogStart = this._fogStartMs.get(nodeId)!
      const isOverheatCdown = this._fogOverheatCooldown.get(nodeId)!

      if (isOverheatCdown) {
        candidateLevel = 0
        if (prevLevel === 0) {
          this._fogOverheatCooldown.set(nodeId, false)
          this._fogStartMs.set(nodeId, 0)
        }
      } else if (candidateLevel > 0) {
        if (fogStart === 0) {
          this._fogStartMs.set(nodeId, nowMs)
        } else if ((nowMs - fogStart) >= FOG_MAX_CONTINUOUS_MS) {
          candidateLevel = 0
          this._fogOverheatCooldown.set(nodeId, true)
          this._fogStartMs.set(nodeId, 0)
        }
      } else {
        this._fogStartMs.set(nodeId, 0)
      }
    }

    this._cachedPump.set(nodeId, candidateLevel)
    this._cachedDensity.set(nodeId, (atmosType === 'fog' || atmosType === 'haze') ? candidateLevel : 0)
    this._cachedFan.set(nodeId, fanSpeed)
    this._prevLevel.set(nodeId, candidateLevel)
  }

  /** Cooldown en ms por tipo de dispositivo. Puro, determinista, sin allocs. */
  private _getCooldownMs(type: AtmosphereType): number {
    switch (type) {
      case 'fog':  return COOLDOWN_FOG_MS
      case 'haze': return COOLDOWN_HAZE_MS
      case 'fan':  return COOLDOWN_FAN_MS
      default:     return 0
    }
  }
}
