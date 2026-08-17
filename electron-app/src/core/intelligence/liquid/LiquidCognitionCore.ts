/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.3 (Lote 3/3: El Núcleo y Shadow Mode)
 *
 * Orquestador del pipeline fluídico completo:
 *   1. FluidDescriptors (Π, M, Δ, G) — EMA lenta 8s
 *   2. CognitiveFluidState — Ψ(t) con todas sus dinámicas
 *   3. SensorFusionChamber — C(t) via media geométrica log
 *   4. IgnitionChamber — Q(t), predicado, intensidad
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §9.2
 */

import type { ILiquidCognitionProfile } from './ILiquidCognitionProfile'
import { DEFAULT_LIQUID_PROFILE } from './ILiquidCognitionProfile'
import { FluidDescriptorEngine, type FluidDescriptors } from './FluidDescriptors'
import { CognitiveFluidState, type FluidStateSnapshot } from './CognitiveFluidState'
import { SensorFusionChamber, type SensorReadout } from './SensorFusionChamber'
import { IgnitionChamber } from './IgnitionChamber'
import type { FrozenGenome } from '../../arsenal/lfxTypes'
import type { MoodId } from '../../mood/types'

// ═══════════════════════════════════════════════════════════════════════════
// Contrato de salida — LiquidVerdict
// ═══════════════════════════════════════════════════════════════════════════

export interface LiquidVerdict {
  /** C ≥ Q — el ÚNICO predicado del sistema cognitivo */
  readonly ignite: boolean
  /** Confianza C(t) — media geométrica de 7 sensores */
  readonly confidence: number
  /** Squelch adaptativo Q(t) — umbral que respira */
  readonly squelch: number
  /** Intensidad materializada [I_min, 1.0] (0 si !ignite) */
  readonly intensity: number
  /** Ruptura relativa max(0, I−T)/T — para ruteo a arsenal divino */
  readonly epicness: number
  /** Desglose de los 7 sensores */
  readonly sensors: SensorReadout
  /** Snapshot del estado fluídico Ψ(t) */
  readonly fluid: FluidStateSnapshot
  /** Humano-legible para debug */
  readonly reasoning: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Input — vista minimal del frame para el pipeline completo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos necesarios para ejecutar el pipeline fluídico completo.
 * Diseñado para ser construible desde el hot path de SeleneTitanConscious.process()
 * sin acoplarse a DecisionInputs interno de think().
 */
export interface LiquidProcessInput {
  // — Energía y Z-Score —
  readonly rawEnergy: number
  readonly zScore: number
  readonly energyMaxHistoric: number

  // — Bandas espectrales —
  readonly bassPresence: number
  readonly midPresence: number

  // — Textura espectral —
  readonly harshness: number
  readonly spectralFlatness: number
  readonly harmonicDensity: number

  // — Ritmo —
  readonly syncopation: number
  readonly rhythmicIntensity: number
  /** Energías por banda [low, mid, high] (0-1) — opcional, activa Π multibanda */
  readonly bandEnergies?: ArrayLike<number>

  // — Cassandra (Oráculo) —
  readonly predictionProbability: number
  readonly predictionAlignment: number

  // — Belleza y Consonancia —
  readonly totalBeauty: number
  readonly consonance: number

  // — Genoma del efecto candidato (para s_DNA) —
  // En Shadow Mode, usar NEUTRAL_GENOME si no hay candidato
  readonly effectGenome: FrozenGenome

  // — Contextual Memory injection (Fase D: phase-aware epicness) —
  /** Fase narrativa actual de ContextualMemory (BUILDING, CLIMAX, RELEASE, etc.) */
  readonly contextualPhase: string
  /** ¿La memoria contextual está calentada? Si false, epicness = 0 */
  readonly isWarmedUp: boolean

  // 🌊 M-SARFE Phase 4: Multi-spectral acoustic reality
  readonly acousticReality?: import('../perception/StateCouplingEnforcer').AcousticRealityState

  /** Active vibe string for genre-aware epicness friction */
  readonly vibe?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Genoma neutral para Shadow Mode (sin candidato específico)
// ═══════════════════════════════════════════════════════════════════════════

export const NEUTRAL_GENOME: FrozenGenome = {
  aggression: 0.5,
  chaos: 0.5,
  organicity: 0.5,
}

// ═══════════════════════════════════════════════════════════════════════════
// Núcleo orquestador — zero-alloc, determinístico
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidCognitionCore {
  private _descriptors: FluidDescriptorEngine
  private _fluidState: CognitiveFluidState
  private _fusion: SensorFusionChamber
  private _ignition: IgnitionChamber
  private _profile: ILiquidCognitionProfile
  private _mood: MoodId = 'balanced'
  private _textureLogFrame: number = 0

  // Mood multipliers — V3.4 Blueprint §14
  private static readonly MOOD_MULTIPLIERS: Record<MoodId, { qScale: number; tauScale: number }> = {
    calm:     { qScale: 1.25, tauScale: 1.5 },
    balanced: { qScale: 1.0,  tauScale: 1.0 },
    punk:     { qScale: 0.75, tauScale: 0.5 },
  }

  // Snapshot pre-asignado — reutilizado entre llamadas
  private readonly _verdict: LiquidVerdict
  private readonly _verdictMut: {
    ignite: boolean; confidence: number; squelch: number
    intensity: number; epicness: number; reasoning: string
  }
  private readonly _sensorsRef: SensorReadout
  private readonly _fluidRef: FluidStateSnapshot

  constructor(
    profile: ILiquidCognitionProfile = DEFAULT_LIQUID_PROFILE,
  ) {
    this._profile = profile
    this._descriptors = new FluidDescriptorEngine()
    this._fluidState = new CognitiveFluidState(profile)
    this._fusion = new SensorFusionChamber(profile)
    this._ignition = new IgnitionChamber(profile)

    // Construir snapshot pre-asignado
    const fluidSnap = this._fluidState.getSnapshot()
    const fusionResult = this._fusion.fuse({
      tension: 0, impact: 0, crestFactor: 0, excitability: 1,
      vaporPressure: 0, rawEnergy: 0, energyMaxHistoric: 1,
      percussiveness: 0, dirtiness: 0, bassPresence: 0, midPresence: 0,
      effectGenome: NEUTRAL_GENOME, predictionProbability: 0,
      predictionAlignment: 0, totalBeauty: 0.5, consonance: 0.7,
    })

    this._verdict = {
      ignite: false,
      confidence: 0,
      squelch: 0,
      intensity: 0,
      epicness: 0,
      sensors: fusionResult.sensors,
      fluid: fluidSnap,
      reasoning: '',
    }

    // Referencias mutables para escritura zero-alloc
    this._verdictMut = this._verdict as {
      ignite: boolean; confidence: number; squelch: number
      intensity: number; epicness: number; reasoning: string
    }
    this._sensorsRef = this._verdict.sensors
    this._fluidRef = this._verdict.fluid
  }

  /**
   * V3.4: Sets mood and applies scalar multipliers to Q_base and tau_r.
   * Called only on mood change (user-driven, rare) — not in hot path.
   * Recreates sub-modules with scaled profile (zero hot-path cost).
   */
  setMood(mood: MoodId): void {
    if (mood === this._mood) return
    this._mood = mood

    const mult = LiquidCognitionCore.MOOD_MULTIPLIERS[mood]
    const base = this._profile

    const scaledProfile: ILiquidCognitionProfile = {
      ...base,
      Q_base:  base.Q_base  * mult.qScale,
      tau_min: base.tau_min * mult.tauScale,
      tau_max: base.tau_max * mult.tauScale,
    }

    this._profile = scaledProfile
    this._fluidState = new CognitiveFluidState(scaledProfile)
    this._ignition = new IgnitionChamber(scaledProfile)
    // SensorFusionChamber and FluidDescriptors are mood-agnostic — no recreation needed
  }

  get mood(): MoodId { return this._mood }

  /** V3.4.4: Acceso directo a descriptores ΠMΔG para telemetría */
  get descriptors(): FluidDescriptors { return this._descriptors.getDescriptors() }

  /** 🪟 Transitorio real (CF>2) en el frame actual — evidencia para Glass Break */
  get crestEvent(): boolean { return this._descriptors.crestEvent }
  /** R(t) — crestas CF>2 por segundo (telemetría) */
  get crestRate(): number { return this._descriptors.crestRate }

  /**
   * Ejecuta el pipeline fluídico completo para un frame.
   * Hot path 44Hz — sin allocs, sin branches de género, determinístico.
   *
   * @param input Datos del frame actual
   * @param now   Timestamp en ms (determinístico)
   * @returns LiquidVerdict pre-asignado (no retener referencia)
   */
  process(input: LiquidProcessInput, now: number): LiquidVerdict {
    // ── 1. Actualizar descriptores ΠMΔG (EMA lenta 8s) ──
    // Π ahora viene del TRUE CREST DETECTOR: necesita rawEnergy + reloj.
    this._descriptors.update({
      midPresence: input.midPresence,
      harshness: input.harshness,
      spectralFlatness: input.spectralFlatness,
      harmonicDensity: input.harmonicDensity,
      syncopation: input.syncopation,
      rhythmicIntensity: input.rhythmicIntensity,
      rawEnergy: input.rawEnergy,
      bandEnergies: input.bandEnergies,
    }, now)

    // ── 1b. TEXTURE RADAR — throttled logger (~2s) — DISABLED (noisy) ──
    // this._textureLogFrame++
    // if (this._textureLogFrame >= 90) {
    //   this._textureLogFrame = 0
    //   const flat = input.spectralFlatness
    //   const melo = this._descriptors.melodicity
    //   const dirt = this._descriptors.dirtiness
    //   const perc = this._descriptors.percussiveness
    //   const groo = this._descriptors.groove
    //   const harsh = input.harshness
    //   const vibe = input.vibe ?? '?'
    //   const bar = (v: number, width = 20) => {
    //     const filled = Math.round(v * width)
    //     return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']'
    //   }
    //   console.log(
    //     `[TEXTURE 🎨] vibe=${vibe} | ` +
    //     `Flat=${flat.toFixed(2)}${bar(flat)} ` +
    //     `Melo=${melo.toFixed(2)}${bar(melo)} ` +
    //     `Dirt=${dirt.toFixed(2)}${bar(dirt)}\n` +
    //     `           Perc=${perc.toFixed(2)}${bar(perc)} ` +
    //     `Groove=${groo.toFixed(2)}${bar(groo)} ` +
    //     `Harsh=${harsh.toFixed(2)}${bar(harsh)}`
    //   )
    // }

    // ── 2. Actualizar estado fluídico Ψ(t) ──
    this._fluidState.update({
      zScore: input.zScore,
      rawEnergy: input.rawEnergy,
      energyMaxHistoric: input.energyMaxHistoric,
      bassPresence: input.bassPresence,
      midPresence: input.midPresence,
      harmonicDensity: input.harmonicDensity,
      spectralFlatness: input.spectralFlatness,
      contextualPhase: input.contextualPhase,
      isWarmedUp: input.isWarmedUp,
      acousticReality: input.acousticReality,
      vibe: input.vibe,
      descriptors: {
        percussiveness: this._descriptors.percussiveness,
        melodicity: this._descriptors.melodicity,
        dirtiness: this._descriptors.dirtiness,
        groove: this._descriptors.groove,
      },
    }, now)

    // ── 3. Fusión de sensores → C(t) ──
    const fluidSnap = this._fluidState.getSnapshot()
    const fusionResult = this._fusion.fuse({
      tension: fluidSnap.tension,
      impact: fluidSnap.impact,
      crestFactor: fluidSnap.crestFactor,
      excitability: fluidSnap.excitability,
      vaporPressure: fluidSnap.vaporPressure,
      rawEnergy: input.rawEnergy,
      energyMaxHistoric: input.energyMaxHistoric,
      percussiveness: this._descriptors.percussiveness,
      dirtiness: this._descriptors.dirtiness,
      bassPresence: input.bassPresence,
      midPresence: input.midPresence,
      effectGenome: input.effectGenome,
      predictionProbability: input.predictionProbability,
      predictionAlignment: input.predictionAlignment,
      totalBeauty: input.totalBeauty,
      consonance: input.consonance,
    })

    // ── 4. Ignición → Q(t), predicado, intensidad ──
    const verdict = this._ignition.evaluate({
      confidence: fusionResult.confidence,
      tension: fluidSnap.tension,
      vaporPressure: fluidSnap.vaporPressure,
      v3Epicness: fluidSnap.epicness,
    })

    // ── 5. Construir LiquidVerdict (zero-alloc) ──
    // Copiar referencias del snapshot fluido y sensores al verdict pre-asignado
    // Los objetos fluid y sensors son los mismos pre-asignados de los sub-módulos
    const v = this._verdictMut
    v.ignite = verdict.ignite
    v.confidence = fusionResult.confidence
    v.squelch = verdict.squelch
    v.intensity = verdict.intensity
    v.epicness = fluidSnap.epicness

    // Reasoning throttled — solo cada ~60 frames para evitar spam
    // En Shadow Mode, reasoning es minimal
    v.reasoning = verdict.ignite
      ? `V3 IGNITE: C=${fusionResult.confidence.toFixed(3)} ≥ Q=${verdict.squelch.toFixed(3)} | I_fx=${verdict.intensity.toFixed(3)}`
      : `V3 HOLD: C=${fusionResult.confidence.toFixed(3)} < Q=${verdict.squelch.toFixed(3)}`

    return this._verdict
  }

  /**
   * Notifica que una ignición fue materializada (V2 disparó un efecto).
   * Resetea presión de vapor y actualiza refractariedad.
   */
  notifyIgnition(intensity: number, now: number): void {
    this._fluidState.notifyIgnition(intensity, now)
  }

  reset(): void {
    this._descriptors.reset()
    this._fluidState.reset()
    this._fusion.reset()
    this._ignition.reset()
    this._verdictMut.ignite = false
    this._verdictMut.confidence = 0
    this._verdictMut.squelch = 0
    this._verdictMut.intensity = 0
    this._verdictMut.epicness = 0
    this._verdictMut.reasoning = ''
  }
}
