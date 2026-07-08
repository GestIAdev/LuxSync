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
// Perfil por defecto — valores "Inicial" del Blueprint §11
// ═══════════════════════════════════════════════════════════════════════════
export const DEFAULT_LIQUID_PROFILE = Object.freeze({
    // — Tensión Superficial —
    T_min: 0.30,
    T_max: 0.85,
    T_base: 0.50,
    kappa_sigma: 0.35,
    alpha_rise: 0.04,
    tau_sat: 6.0,
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
    w1: 0.22,
    w2: 0.20,
    w3: 0.15,
    w4: 0.15,
    w5: 0.12,
    w6: 0.08,
    w7: 0.08,
    sigma_g: 0.35,
    kappa_z: 4.0,
    b_z: 0.0,
    gamma_e: 0.7,
    kappa_v: 5.0,
    rho_v: 1.6,
    kappa_vmax: 0.75,
    // — Ignición —
    Q_base: 0.45,
    kappa_T: 0.50,
    kappa_V: 0.40,
    I_min: 0.35,
    kappa_i: 2.0,
    kappa_vb: 0.10,
    kappa_rep: 0.6,
    tau_novelty: 45.0,
    epsilon_divine: 0.25,
});
