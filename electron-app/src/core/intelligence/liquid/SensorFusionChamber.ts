/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.2 (Lote 2/3: Fusión e Ignición)
 *
 * Cámara de Fusión de Sensores — media geométrica ponderada en dominio log.
 * 7 sensores agnósticos que reemplazan los 20 vetos booleanos de V2.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §6
 */

import type { ILiquidCognitionProfile } from './ILiquidCognitionProfile'

// ═══════════════════════════════════════════════════════════════════════════
// Contratos de datos
// ═══════════════════════════════════════════════════════════════════════════

/** Desglose individual de cada sensor (para telemetría/debug) */
export interface SensorReadout {
  readonly s_DNA: number
  readonly s_Z: number
  readonly s_E: number
  readonly s_V: number
  readonly s_X: number
  readonly s_P: number
  readonly s_B: number
}

/** Resultado de la fusión — confianza + desglose */
export interface SensorFusionResult {
  readonly confidence: number
  readonly sensors: SensorReadout
}

// ═══════════════════════════════════════════════════════════════════════════
// Input — vista minimal del frame para computar los 7 sensores
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos necesarios para computar C(t).
 * Vista minimal desacoplada de TitanStabilizedState / SeleneMusicalPattern / etc.
 */
export interface SensorFusionInput {
  // — Estado fluídico (de CognitiveFluidState) —
  readonly tension: number       // T(t)
  readonly impact: number        // I(t)
  readonly crestFactor: number   // CF̂(t)
  readonly excitability: number  // X(t)
  readonly vaporPressure: number // V(t)

  // — Energía —
  readonly rawEnergy: number           // Ê(t) normalizada 0-1
  readonly energyMaxHistoric: number   // para normalizar Ê

  // — Descriptores fluídicos (de FluidDescriptorEngine) —
  readonly percussiveness: number // Π
  readonly dirtiness: number      // Δ

  // — Espectrales —
  readonly bassPresence: number
  readonly midPresence: number

  // — Cassandra (Oráculo) —
  readonly predictionProbability: number  // 0-1
  readonly predictionAlignment: number    // 0-1, alineación tipo/fase

  // — Belleza y Consonancia —
  readonly totalBeauty: number     // 0-1
  readonly consonance: number      // 0-1
}

// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════

/** Epsilon para evitar ln(0) en dominio logarítmico */
const EPSILON = 0.01

// ═══════════════════════════════════════════════════════════════════════════
// Engine — zero-alloc, determinístico
// ═══════════════════════════════════════════════════════════════════════════

export class SensorFusionChamber {
  // Snapshot pre-asignado — reutilizado entre llamadas
  private readonly _result: SensorFusionResult = {
    confidence: 0,
    sensors: {
      s_DNA: 0, s_Z: 0, s_E: 0, s_V: 0, s_X: 0, s_P: 0, s_B: 0,
    },
  }

  // Referencias mutables internas al snapshot para escritura directa
  private readonly _sensors: {
    s_DNA: number; s_Z: number; s_E: number; s_V: number
    s_X: number; s_P: number; s_B: number
  }

  constructor(
    private readonly profile: ILiquidCognitionProfile,
  ) {
    // Capturamos la referencia interna para escribir sin alloc
    this._sensors = this._result.sensors as {
      s_DNA: number; s_Z: number; s_E: number; s_V: number
      s_X: number; s_P: number; s_B: number
    }
  }

  /**
   * Computa la confianza C(t) via media geométrica ponderada en dominio log.
   *
   * ln C(t) = Σ wᵢ · ln sᵢ(t)   →   C(t) = exp(Σ wᵢ · ln sᵢ)
   *
   * Hot path 44Hz — sin allocs, sin branches de género.
   *
   * @returns SensorFusionResult pre-asignado (no retener referencia)
   */
  fuse(input: SensorFusionInput): SensorFusionResult {
    const p = this.profile

    // ── s_DNA — Internal coherence of the Projected Context Genome ──
    // g_ctx = ⟨Ê·CF̂, Δ, 1−Π⟩  (Energy×Crest, Harshness, 1−Percussiveness)
    //
    // The legacy code compared g_ctx to a hardcoded NEUTRAL_GENOME (0.5/0.5/0.5),
    // measuring "distance from neutral" — a short-circuit that penalised any
    // context far from the arbitrary midpoint. The refactored s_DNA measures
    // the INTERNAL COHERENCE of the acoustic context itself: the geometric mean
    // of the three g_ctx components in log-domain. High when all three are
    // present (a clear, formed acoustic signature), low when the context is
    // weak or undefined. No external reference genome required.
    //
    // s_DNA = (a · c · o)^(1/3)  where  a=Ê·CF̂, c=Δ, o=1−Π
    const ctxA = input.rawEnergy * input.crestFactor
    const ctxC = input.dirtiness
    const ctxO = 1 - input.percussiveness
    const s_DNA = Math.exp(
      (Math.log(Math.max(ctxA, EPSILON)) +
       Math.log(Math.max(ctxC, EPSILON)) +
       Math.log(Math.max(ctxO, EPSILON))) / 3,
    )

    // ── s_Z — Anomalía normalizada por tensión ──
    // s_Z = σ(κ_z · (I/T − 1) + b_z)
    const ratioIT = input.tension > 0.001 ? input.impact / input.tension : 0
    const s_Z = 1 / (1 + Math.exp(-(p.kappa_z * (ratioIT - 1) + p.b_z)))

    // ── s_E — Energía líquida comprimida ──
    // s_E = Ê^γ_e
    const eHat = input.rawEnergy / Math.max(input.energyMaxHistoric, 0.01)
    const s_E = Math.pow(eHat, p.gamma_e)

    // ── s_V — Filtro espectral anti-voz ──
    // vocalDominance = σ(κ_v · (mid/(bass+ε) − ρ_v)) · (1 − CF̂)
    // s_V = 1 − κ_vmax · vocalDominance
    const midBassRatio = input.midPresence / (input.bassPresence + EPSILON)
    const vocalSig = 1 / (1 + Math.exp(-(p.kappa_v * (midBassRatio - p.rho_v))))
    const vocalDominance = vocalSig * (1 - input.crestFactor)
    const s_V = 1 - p.kappa_vmax * vocalDominance

    // ── s_X — Excitabilidad (passthrough) ──
    const s_X = input.excitability

    // ── s_P — Prior de Cassandra ──
    // s_P = 0.5 + 0.5 · P_aligned
    // P_aligned = prediction.probability · alignment
    const pAligned = input.predictionProbability * input.predictionAlignment
    const s_P = 0.5 + 0.5 * pAligned

    // ── s_B — Belleza y Consonancia ──
    // s_B = 0.6 + 0.4 · (0.6 · beauty + 0.4 · consonance)
    const s_B = 0.6 + 0.4 * (0.6 * input.totalBeauty + 0.4 * input.consonance)

    // ── Clamp todos a [ε, 1] ──
    const clamped_DNA = s_DNA < EPSILON ? EPSILON : s_DNA > 1 ? 1 : s_DNA
    const clamped_Z   = s_Z   < EPSILON ? EPSILON : s_Z   > 1 ? 1 : s_Z
    const clamped_E   = s_E   < EPSILON ? EPSILON : s_E   > 1 ? 1 : s_E
    const clamped_V   = s_V   < EPSILON ? EPSILON : s_V   > 1 ? 1 : s_V
    const clamped_X   = s_X   < EPSILON ? EPSILON : s_X   > 1 ? 1 : s_X
    const clamped_P   = s_P   < EPSILON ? EPSILON : s_P   > 1 ? 1 : s_P
    const clamped_B   = s_B   < EPSILON ? EPSILON : s_B   > 1 ? 1 : s_B

    // ── Media geométrica en dominio log ──
    // ln C = w1·ln(s_DNA) + w2·ln(s_Z) + ... + w7·ln(s_B)
    const lnC =
      p.w1 * Math.log(clamped_DNA) +
      p.w2 * Math.log(clamped_Z) +
      p.w3 * Math.log(clamped_E) +
      p.w4 * Math.log(clamped_V) +
      p.w5 * Math.log(clamped_X) +
      p.w6 * Math.log(clamped_P) +
      p.w7 * Math.log(clamped_B)

    const confidence = Math.exp(lnC)

    // ── Escribir snapshot pre-asignado ──
    this._sensors.s_DNA = clamped_DNA
    this._sensors.s_Z = clamped_Z
    this._sensors.s_E = clamped_E
    this._sensors.s_V = clamped_V
    this._sensors.s_X = clamped_X
    this._sensors.s_P = clamped_P
    this._sensors.s_B = clamped_B
    ;(this._result as { confidence: number }).confidence = confidence

    return this._result
  }

  reset(): void {
    this._sensors.s_DNA = 0
    this._sensors.s_Z = 0
    this._sensors.s_E = 0
    this._sensors.s_V = 0
    this._sensors.s_X = 0
    this._sensors.s_P = 0
    this._sensors.s_B = 0
    ;(this._result as { confidence: number }).confidence = 0
  }
}
