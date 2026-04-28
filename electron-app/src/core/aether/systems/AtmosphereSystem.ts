/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️ AETHER MATRIX — ATMOSPHERE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3509: THE FINAL NODES (F3) — Familia ATMOSPHERE completa.
 *
 * RESPONSABILIDAD:
 * Controlar los dispositivos atmosféricos no-lumínicos del escenario:
 * máquinas de humo (fog), hazer, generadores de chispas (spark),
 * y ventiladores (fan).
 *
 * DOMINIO:
 * A diferencia de los otros Systems, ATMOSPHERE no es puramente reactivo
 * al audio frame a frame. Los dispositivos atmosféricos tienen:
 * 1. RETRASO FÍSICO: El humo tarda segundos en llenar el espacio.
 * 2. COOLDOWN OBLIGATORIO: Las máquinas de humo se sobrecalientan.
 * 3. INTERLOCKS DE SEGURIDAD: Chispas + humo denso = peligro real.
 *
 * Sin embargo, la CANTIDAD de atmósfera sí responde al contexto musical:
 * en el drop queremos máxima densidad, en el break relajamos.
 *
 * SEGURIDAD — LOS TRES SAFETY GATES:
 *
 * GATE 1 — COOLDOWN (fog/haze):
 *   Si node.safety.cooldownRemaining > 0 → output = 0 (motor apagado).
 *   El fan puede seguir al mínimo para disipar calor residual.
 *
 * GATE 2 — MÁXIMO CONTINUO (fog):
 *   Si node.safety.totalActiveMs > FOG_MAX_CONTINUOUS_MS → output = 0.
 *   Las máquinas de humo de calor no pueden operar indefinidamente.
 *
 * GATE 3 — INTERLOCK SPARK (spark):
 *   Los generadores de chispas tienen su propia lógica de habilitación.
 *   En esta arquitectura, el interlock lo gestiona una capa superior
 *   (el operador / cue system). AtmosphereSystem respeta safetyState.cooldownRemaining = 0.
 *   Si el cooldown está activo → output = 0. Sin excepciones.
 *
 * CANALES CONTROLADOS:
 * - 'output'     → potencia del dispositivo (0-1)
 * - 'fan_speed'  → velocidad del ventilador / disipador (0-1)
 * - 'density'    → densidad del fluido (si el hardware lo soporta) (0-1)
 *
 * LÓGICA POR TIPO:
 * - fog    → cíclico: output breve → cooldown → repeat. Fan sube al máximo si overheated.
 * - haze   → continuo: output bajo y estable. No tiene cooldown obligatorio.
 * - spark  → activación controlada: output = 0 excepto en momentos clave del drop.
 * - fan    → continuo: fan_speed reactiva al audio (agita el humo existente).
 * - pyro   → single-shot: gestionado por cue system, AtmosphereSystem no lee de audio.
 * - custom → sin assumptions. Responde solo a energy global.
 *
 * ZERO-ALLOC GARANTIZADO @ 44Hz:
 * - `_intentScratch` + `_valuesDict` heredados de BaseSystem — reutilizados.
 * - `node.safety` es un objeto mutable in-place con campos primitivos.
 * - No se crean objetos en el hot-path. Solo lectura + aritmética escalar.
 *
 * @module core/aether/systems/AtmosphereSystem
 * @version WAVE 3509 — THE FINAL NODES F3
 */

import { NodeFamily } from '../types'
import type { AtmosphereType, AtmosphereSafetyState } from '../types'
import type { IAtmosphereNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import {
  BaseSystem,
  type IAetherSystem,
  type FrameContext,
} from './BaseSystem'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Priority L0 — sistemas base */
const ATMOS_INTENT_PRIORITY = 10

/**
 * Tiempo máximo de activación continua para máquinas de humo de calor (fog).
 * Pasado este límite el sistema fuerza cooldown de seguridad.
 * Basado en specs típicas: ~3-4 minutos máximo de operación continua.
 * (Blueprint §4.5: "Cooldown obligatorio para fog")
 */
const FOG_MAX_CONTINUOUS_MS = 180_000  // 3 minutos

/**
 * Output base para haze: funcionamiento continuo y suave.
 * No queremos un hazer a plena potencia — se satura rápido el aire.
 */
const HAZE_BASE_OUTPUT = 0.35

/**
 * Output base para fan: velocidad mínima en silencio.
 * Evita que el ventilador se escuche en momentos de silencio.
 */
const FAN_MIN_OUTPUT = 0.10

/**
 * Threshold de energía sobre el cual los chispas se activan.
 * Solo en drops con energía alta y factor de vibe suficiente.
 */
const SPARK_ENERGY_THRESHOLD = 0.80

/**
 * La velocidad del fan se eleva para "agitar" el humo existente en drops.
 * Pero nunca a velocidades audibles en momentos tranquilos.
 */
const FAN_MAX_OUTPUT_DROP = 0.75

/**
 * Output de output para máquinas de humo por sección musical.
 * El fog trabaja en ráfagas — la sección define la intensidad de cada ráfaga.
 */
const FOG_OUTPUT_BY_SECTION: Readonly<Record<string, number>> = {
  intro:    0.30,  // entrada suave
  verse:    0.20,  // fondo atmosférico
  build:    0.50,  // construyendo atmósfera
  drop:     0.90,  // máxima densidad — el gran momento
  break:    0.10,  // descanso — atmósfera residual
  outro:    0.15,  // cierre
  unknown:  0.25,
}

/**
 * Velocidad del fan por sección.
 * El fan mueve el humo para distribuirlo — en el drop queremos que
 * el humo "llene" el espacio rápidamente.
 */
const FAN_SPEED_BY_SECTION: Readonly<Record<string, number>> = {
  intro:    0.20,
  verse:    0.20,
  build:    0.35,
  drop:     FAN_MAX_OUTPUT_DROP,
  break:    0.15,
  outro:    0.15,
  unknown:  0.20,
}

/**
 * Densidad de fluido por sección (para hardware que lo soporta).
 * Algunos hazer tienen control de densidad separado del caudal.
 */
const DENSITY_BY_SECTION: Readonly<Record<string, number>> = {
  intro:    0.40,
  verse:    0.35,
  build:    0.60,
  drop:     1.00,  // máxima densidad
  break:    0.20,
  outro:    0.25,
  unknown:  0.40,
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export class AtmosphereSystem
  extends BaseSystem<IAtmosphereNodeData>
  implements IAetherSystem<IAtmosphereNodeData>
{
  readonly name   = 'AtmosphereSystem'
  readonly family = NodeFamily.ATMOSPHERE

  constructor() {
    super()
    this._intentScratch.source   = 'atmos_system'
    this._intentScratch.priority = ATMOS_INTENT_PRIORITY
    this._intentScratch.confidence = 1.0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-PATH — 44Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    view: INodeView<IAtmosphereNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    const { audio, musical, vibe } = context
    const section = musical.section

    // Precompute section lookups — O(1), zero-alloc, escalares del stack.
    const fogOutputBase   = FOG_OUTPUT_BY_SECTION[section]  ?? FOG_OUTPUT_BY_SECTION['unknown']!
    const fanSpeedBase    = FAN_SPEED_BY_SECTION[section]   ?? FAN_SPEED_BY_SECTION['unknown']!
    const densityBase     = DENSITY_BY_SECTION[section]     ?? DENSITY_BY_SECTION['unknown']!

    // Modulación de energía global sobre los valores base.
    // Energía reactiva pero SUAVIZADA — la atmósfera no parpadea con cada beat.
    const energyMod = BaseSystem.clamp01(audio.energy * 0.4 + 0.6)  // [0.6 .. 1.0]

    view.forEach((node: IAtmosphereNodeData) => {
      // ── SAFETY GATE GLOBAL ─────────────────────────────────────────────
      // Si el cooldown está activo, todo output = 0. Sin excepción.
      // Esta es la primera comprobación — si se activa, silenciamos el nodo
      // y continuamos al siguiente sin más cálculos.
      if (node.safety.cooldownRemaining > 0) {
        this._writeShutdown(node, bus)
        return
      }

      // ── Dispatching por tipo de dispositivo ───────────────────────────
      switch (node.atmosType as AtmosphereType) {
        case 'fog':
          this._processFog(node, fogOutputBase, fanSpeedBase, densityBase, energyMod, context, bus)
          break

        case 'haze':
          this._processHaze(node, densityBase, fanSpeedBase, energyMod, bus)
          break

        case 'spark':
          this._processSpark(node, audio.energy, vibe.intensity, context, bus)
          break

        case 'fan':
          this._processFan(node, fanSpeedBase, audio.energy, bus)
          break

        case 'pyro':
          // Pirotecnia: AtmosphereSystem NO la controla por audio.
          // La pirotecnia es un single-shot que gestiona el cue system.
          // Aquí simplemente no hacemos nada — output = 0 por default LTP.
          break

        case 'custom':
          this._processCustom(node, fogOutputBase, fanSpeedBase, energyMod, bus)
          break
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PER-TYPE HANDLERS — cero alloc, solo aritmética escalar
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * FOG — Máquina de humo con cooldown de temperatura.
   *
   * Safety Gate 2: si se supera el máximo de activación continua,
   * forzar cooldown (output=0, fan alto para disipar calor).
   */
  private _processFog(
    node: IAtmosphereNodeData,
    outputBase: number,
    fanBase: number,
    densityBase: number,
    energyMod: number,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    // Safety Gate 2: tiempo máximo continuo
    if (node.safety.totalActiveMs > FOG_MAX_CONTINUOUS_MS) {
      this._writeShutdown(node, bus)
      return
    }

    // Calcular output escalado por energía y vibe.intensity
    const output  = BaseSystem.clamp01(outputBase * energyMod * context.vibe.intensity)
    const fanSpeed = BaseSystem.clamp01(fanBase * energyMod)
    const density  = BaseSystem.clamp01(densityBase * context.musical.sectionIntensity)

    this._pushIntent(node, output, fanSpeed, density, bus)
  }

  /**
   * HAZE — Hazer de aceite/agua de funcionamiento continuo.
   *
   * Sin cooldown. Output bajo y estable. La densidad varía suavemente
   * según la sección. No reacciona a transientes individuales.
   */
  private _processHaze(
    node: IAtmosphereNodeData,
    densityBase: number,
    fanBase: number,
    energyMod: number,
    bus: IIntentBus,
  ): void {
    // El hazer funciona siempre a output base — solo la densidad varía.
    const output   = BaseSystem.clamp01(HAZE_BASE_OUTPUT * energyMod)
    const fanSpeed = BaseSystem.clamp01(fanBase * 0.6)  // el fan del hazer es discreto
    const density  = BaseSystem.clamp01(densityBase)

    this._pushIntent(node, output, fanSpeed, density, bus)
  }

  /**
   * SPARK — Generador de chispas (Sparkular / FX similares).
   *
   * Solo se activa en drops con energía > threshold y vibe suficiente.
   * No es continuo — ráfagas controladas por el beat.
   *
   * Safety: el cooldown ya fue validado en el gate global. Aquí
   * solo decidimos si la energía actual justifica el disparo.
   */
  private _processSpark(
    node: IAtmosphereNodeData,
    energy: number,
    vibeIntensity: number,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
    const inDrop = context.musical.section === 'drop'

    // El spark se activa solo en drops con energía y vibe altos.
    // La intensidad del spark escala con la fuerza del transiente.
    let output = 0
    if (inDrop && energy >= SPARK_ENERGY_THRESHOLD && vibeIntensity >= 0.7) {
      if (context.audio.hasTransient) {
        output = BaseSystem.clamp01(context.audio.transientStrength * vibeIntensity)
      } else {
        // Sin transiente activo: spark a nivel bajo (presencia de fondo)
        output = BaseSystem.clamp01((energy - SPARK_ENERGY_THRESHOLD) * 0.5 * vibeIntensity)
      }
    }

    // Los Sparkular no tienen fan_speed ni density en sentido tradicional.
    // Usamos fan_speed=0 y density=output (la densidad de chispas = output).
    this._pushIntent(node, output, 0, output, bus)
  }

  /**
   * FAN — Ventilador direccional puro.
   *
   * Reactivo al audio: agita el humo existente en escena.
   * Alta energía → más velocidad → mayor distribución del haze.
   * En silencio: velocidad mínima para mantenimiento de circulación.
   */
  private _processFan(
    node: IAtmosphereNodeData,
    fanBase: number,
    energy: number,
    bus: IIntentBus,
  ): void {
    // El fan siempre tiene un mínimo para no sonar a cero.
    const fanSpeed = BaseSystem.clamp01(
      Math.max(FAN_MIN_OUTPUT, fanBase + energy * 0.25),
    )

    // output = 0 para fans puros (el canal 'output' no aplica a fans direccionales).
    // density = 0 (no tienen densidad).
    this._pushIntent(node, 0, fanSpeed, 0, bus)
  }

  /**
   * CUSTOM — Dispositivo no clasificado.
   *
   * Responde proporcionalmente a energía y sección musical.
   * Sin safety assumptions específicas más allá del cooldown global.
   */
  private _processCustom(
    node: IAtmosphereNodeData,
    outputBase: number,
    fanBase: number,
    energyMod: number,
    bus: IIntentBus,
  ): void {
    const output   = BaseSystem.clamp01(outputBase * energyMod)
    const fanSpeed = BaseSystem.clamp01(fanBase * energyMod)

    this._pushIntent(node, output, fanSpeed, 0, bus)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH HELPERS — cero alloc, mutan scratch in-place
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Empuja un intent de shutdown al bus (output=0, fanSpeed mínimo para cooling).
   *
   * Usado por los safety gates cuando el dispositivo debe apagarse.
   * El fan permanece al mínimo para disipar calor residual en fog/haze.
   */
  private _writeShutdown(node: IAtmosphereNodeData, bus: IIntentBus): void {
    this._intentScratch.nodeId     = node.nodeId
    this._intentScratch.confidence = 1.0  // shutdown es determinístico — máxima confianza

    this._valuesDict['output']    = 0
    this._valuesDict['fan_speed'] = FAN_MIN_OUTPUT  // cooling mínimo activo
    this._valuesDict['density']   = 0

    bus.push(this._intentScratch as INodeIntent)
  }

  /**
   * Empuja un intent atmosférico normal con los tres canales.
   * Zero-alloc: muta `_intentScratch` y `_valuesDict` in-place.
   */
  private _pushIntent(
    node: IAtmosphereNodeData,
    output: number,
    fanSpeed: number,
    density: number,
    bus: IIntentBus,
  ): void {
    this._intentScratch.nodeId     = node.nodeId
    this._intentScratch.confidence = BaseSystem.clamp01(output)

    this._valuesDict['output']    = output
    this._valuesDict['fan_speed'] = fanSpeed
    this._valuesDict['density']   = density

    bus.push(this._intentScratch as INodeIntent)
  }
}
