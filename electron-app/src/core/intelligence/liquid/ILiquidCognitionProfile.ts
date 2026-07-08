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
  /** Peso del Z-Score en el impacto I(t) */
  readonly w_z: number
  /** Peso del Factor de Cresta en el impacto I(t) */
  readonly w_cf: number
  /** Peso de la energía líquida en el impacto I(t) */
  readonly w_e: number
  /** Punto de saturación del Z-Score (tanh) */
  readonly z_ref: number
  /** Punto de saturación del Factor de Cresta */
  readonly CF_ref: number
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
  T_base: 0.600,       // ⬇ 0.800 → 0.600 (relaxed for fluidity)
  kappa_sigma: 0.800,   // ⬆ 0.35 → 0.800 (MC)
  alpha_rise: 0.010,    // ⬇ 0.04 → 0.010 (MC)
  tau_sat: 1.0,         // ⬇ 6.0  → 1.0   (MC)
  lambda_0: 0.008,
  kappa_d: 2.5,
  D_half: 8.0,
  lambda_home: 0.015,
  w_z: 0.45,
  w_cf: 0.30,
  w_e: 0.25,
  z_ref: 3.0,
  CF_ref: 3.5,

  // — Inercia y Vapor —
  tau_min: 1.5,
  tau_max: 9.0,
  w_m: 0.40,
  w_f: 0.25,
  w_h: 0.20,
  w_p: 0.30,
  beta_v: 0.03,
  kappa_vreset: 0.15,

  // — Fusión —
  w1: 0.1699,  // ⬇ 0.22 (MC) — s_DNA
  w2: 0.0291,  // ⬇ 0.20 (MC) — s_Z
  w3: 0.3252,  // ⬆ 0.15 (MC) — s_E (dominante)
  w4: 0.1515,  // ≈ 0.15 (MC) — s_V
  w5: 0.0273,  // ⬇ 0.12 (MC) — s_X
  w6: 0.2766,  // ⬆ 0.08 (MC) — s_P (Cassandra)
  w7: 0.0204,  // ⬇ 0.08 (MC) — s_B
  sigma_g: 0.35,
  kappa_z: 4.0,
  b_z: 0.0,
  gamma_e: 0.7,
  kappa_v: 5.0,
  rho_v: 1.6,
  kappa_vmax: 0.75,

  // — Ignición —
  Q_base: 0.550,       // ⬇ 0.700 → 0.550 (relaxed for fluidity)
  kappa_T: 0.50,
  kappa_V: 0.40,
  I_min: 0.35,
  kappa_i: 2.0,
  kappa_vb: 0.10,
  kappa_rep: 0.6,
  tau_novelty: 45.0,
  epsilon_divine: 0.25,
})
