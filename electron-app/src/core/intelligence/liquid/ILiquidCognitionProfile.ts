/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.1 (Lote 1/4: Cimientos)
 *
 * Contrato de datos puro: todos los coeficientes del fluido cognitivo.
 * Calibrable por Monte Carlo sin recompilar. Paralelo a ILiquidProfile del Omniliquid.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §11
 */

// ═══════════════════════════════════════════════════════════════════════════
// Tensión Superficial Cognitiva (§3)
// ═══════════════════════════════════════════════════════════════════════════

export interface TensionCoefficients {
  /** Suelo de la barrera épica */
  readonly T_min: number
  /** Techo de la barrera épica */
  readonly T_max: number
  /** Tensión de equilibrio base */
  readonly T_base: number
  /** Acople dispersión histórica → equilibrio */
  readonly kappa_sigma: number
  /** Endurecimiento por frame de clímax */
  readonly alpha_rise: number
  /** Vida media de la saturación S(t) en segundos */
  readonly tau_sat: number
  /** Evaporación base por frame */
  readonly lambda_0: number
  /** Ganancia de sequía */
  readonly kappa_d: number
  /** Semisaturación de sequía en segundos */
  readonly D_half: number
  /** Relajación homeostática por frame */
  readonly lambda_home: number
  /** @deprecated Use w_E (multi-spectral). Peso del Z-Score en el impacto I(t) */
  readonly w_z: number
  /** @deprecated Use w_CF (multi-spectral). Peso del Factor de Cresta en el impacto I(t) */
  readonly w_cf: number
  /** @deprecated Use w_E (multi-spectral). Peso de la energía líquida en el impacto I(t) */
  readonly w_e: number
  /** Punto de saturación del Z-Score (tanh) */
  readonly z_ref: number
  /** Punto de saturación del Factor de Cresta */
  readonly CF_ref: number

  // 🌊 M-SARFE Phase 4: Multi-Spectral Impact Weights
  /** Peso del Z-Score total (anomalía de energía global) */
  readonly w_E: number
  /** Peso del Z-Score de bass (dominancia de graves) */
  readonly w_low: number
  /** Peso del Z-Score de agudos (anomalía de alta frecuencia) */
  readonly w_high: number
  /** Peso del Crest Factor de agudos (detección vocal/transitorios) */
  readonly w_CF: number
  /** Peso de la tensión espectral T(t) */
  readonly w_T: number
  /** Peso de la divergencia espectral D(t) */
  readonly w_D: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Inercia Cognitiva y Presión de Vapor (§4-5)
// ═══════════════════════════════════════════════════════════════════════════

export interface InertiaCoefficients {
  /** Refractariedad mínima en segundos (agua) */
  readonly tau_min: number
  /** Refractariedad máxima en segundos (brea) */
  readonly tau_max: number
  /** Peso de melodicidad en viscosidad */
  readonly w_m: number
  /** Peso de flatness en viscosidad */
  readonly w_f: number
  /** Peso de densidad armónica en viscosidad */
  readonly w_h: number
  /** Peso de percusividad en viscosidad (resta) */
  readonly w_p: number
  /** Tasa de acumulación de presión de vapor por segundo */
  readonly beta_v: number
  /** Vapor residual post-ignición */
  readonly kappa_vreset: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Sensor Fusion e Ignición (§6-7)
// ═══════════════════════════════════════════════════════════════════════════

export interface FusionCoefficients {
  /** Peso s_DNA (afinidad genómica) */
  readonly w1: number
  /** Peso s_Z (anomalía normalizada) */
  readonly w2: number
  /** Peso s_E (energía líquida) */
  readonly w3: number
  /** Peso s_V (filtro anti-voz) */
  readonly w4: number
  /** Peso s_X (excitabilidad) */
  readonly w5: number
  /** Peso s_P (prior de Cassandra) */
  readonly w6: number
  /** Peso s_B (belleza y consonancia) */
  readonly w7: number
  /** Anchura del kernel gaussiano ACO */
  readonly sigma_g: number
  /** Pendiente de s_Z */
  readonly kappa_z: number
  /** Bias de s_Z */
  readonly b_z: number
  /** Compresión de energía (γ_e) */
  readonly gamma_e: number
  /** Pendiente del filtro anti-voz */
  readonly kappa_v: number
  /** Ratio mid/bass de referencia para voz */
  readonly rho_v: number
  /** Penalización máxima del filtro anti-voz */
  readonly kappa_vmax: number
}

export interface IgnitionCoefficients {
  /** Squelch de reposo */
  readonly Q_base: number
  /** Respiración del squelch por tensión */
  readonly kappa_T: number
  /** Respiración del squelch por vapor */
  readonly kappa_V: number
  /** Intensidad mínima materializada */
  readonly I_min: number
  /** Ganancia de intensidad por exceso de ruptura */
  readonly kappa_i: number
  /** Bonus de intensidad por presión de vapor */
  readonly kappa_vb: number
  /** Penalización de frescura del arsenal */
  readonly kappa_rep: number
  /** Vida media de novedad del arsenal en segundos */
  readonly tau_novelty: number
  /** Ruptura mínima para arsenal divino */
  readonly epsilon_divine: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Contrato Maestro
// ═══════════════════════════════════════════════════════════════════════════

export interface ILiquidCognitionProfile
  extends TensionCoefficients, InertiaCoefficients, FusionCoefficients, IgnitionCoefficients {}

// ═══════════════════════════════════════════════════════════════════════════
// Perfil calibrado — WAVE 7004.4 Monte Carlo Batch Calibration
// 10 tracks, Simulated Annealing multi-start, coste global ponderado
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_LIQUID_PROFILE: Readonly<ILiquidCognitionProfile> = Object.freeze({
  // — Tensión Superficial —
  T_min: 0.30,
  T_max: 0.85,
  T_base: 0.400,       // ⬇ 0.600 → 0.400 — homeostatic target drops to ~0.40-0.48, lets tension relax in techno minimal
  kappa_sigma: 0.20,    // tEq = T_base + 0.20*temp stays in [0.40, 0.57]
  alpha_rise: 0.010,    // ⬇ 0.04 → 0.010 (MC)
  tau_sat: 1.0,         // ⬇ 6.0  → 1.0   (MC)
  lambda_0: 0.008,
  kappa_d: 2.5,
  D_half: 8.0,
  lambda_home: 0.020,  // ⬆ 0.015 → 0.020 — faster homeostatic pull toward lower T_base
  w_z: 0.45,
  w_cf: 0.30,
  w_e: 0.25,
  z_ref: 3.0,
  CF_ref: 3.5,
  // 🌊 M-SARFE Phase 4: Multi-Spectral Impact Weights (default)
  w_E: 0.30,
  w_low: 0.15,
  w_high: 0.20,
  w_CF: 0.15,
  w_T: 0.12,
  w_D: 0.08,

  // — Inercia y Vapor —
  tau_min: 1.5,
  tau_max: 9.0,
  w_m: 0.50,          // FIX: 0.40→0.50 — aumentar peso de melodicidad para μ no colapse en techno
  w_f: 0.25,
  w_h: 0.20,
  w_p: 0.10,          // FIX: 0.30→0.10 — w_p=0.30 dominaba en techno (Π~0.6-0.9) y forzaba μ=0.000
  beta_v: 0.015,       // ⬇ 0.03 → 0.015 (Fase 3: slower vapor accumulation in valleys)
  kappa_vreset: 0.15,

  // — Fusión —
  w1: 0.1699,  // ⬇ 0.22 (MC) — s_DNA
  w2: 0.0291,  // ⬇ 0.20 (MC) — s_Z
  w3: 0.4518,  // ⬆ 0.3252+0.1266 (Fase 5: Cassandra weight redistributed to s_E)
  w4: 0.1515,  // ≈ 0.15 (MC) — s_V
  w5: 0.0273,  // ⬇ 0.12 (MC) — s_X
  w6: 0.1500,  // ⬇ 0.2766 → 0.15 (Fase 5: Cassandra inflated base confidence)
  w7: 0.0204,  // ⬇ 0.08 (MC) — s_B
  // 🔬 WAVE 7539: Widened from 0.35 → 0.65 (Confidence Resuscitation, Option A).
  // The original 0.35 was calibrated for the ACO (Acoustic Coherence Operator)
  // where both vectors were acoustic descriptors. The new Context-Genome
  // Resonance pairs acoustic g_ctx with genetic g_fx — semantically different
  // axes that naturally produce larger distances. With σ_g=0.35, any distSq>0.56
  // collapsed s_DNA to the EPSILON floor, suppressing C(t) below Q_base.
  // σ_g=0.65 gives 2σ_g²≈0.845, so a moderate distSq=0.5 yields s_DNA≈0.55
  // instead of 0.13 — a healthy resonance that doesn't kill ignition.
  sigma_g: 0.65,
  kappa_z: 4.0,
  b_z: 0.0,
  gamma_e: 0.7,
  kappa_v: 5.0,
  rho_v: 1.2,          // ⬇ 1.6 → 1.2 (Fase 4: anti-voice triggers earlier)
  kappa_vmax: 0.90,    // ⬆ 0.75 → 0.90 (Fase 4: harder vocal penalty)

  // — Ignición —
  Q_base: 0.650,       // ⬆ 0.550 → 0.650 (reverted from artificial lower; was 0.700 original)
  kappa_T: 0.50,
  kappa_V: 0.40,
  I_min: 0.35,
  kappa_i: 2.0,
  kappa_vb: 0.10,
  kappa_rep: 0.6,
  tau_novelty: 45.0,
  epsilon_divine: 0.60,  // ⬆ 0.40 → 0.60 (radical high-pass: only devastating impact qualifies)
})
