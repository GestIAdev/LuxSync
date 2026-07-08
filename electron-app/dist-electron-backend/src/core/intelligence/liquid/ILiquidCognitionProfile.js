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
// Perfil calibrado — WAVE 7004.4 Monte Carlo Batch Calibration
// 10 tracks, Simulated Annealing multi-start, coste global ponderado
// ═══════════════════════════════════════════════════════════════════════════
export const DEFAULT_LIQUID_PROFILE = Object.freeze({
    // — Tensión Superficial —
    T_min: 0.30,
    T_max: 0.85,
    T_base: 0.600, // ⬇ 0.800 → 0.600 (relaxed for fluidity)
    kappa_sigma: 0.800, // ⬆ 0.35 → 0.800 (MC)
    alpha_rise: 0.010, // ⬇ 0.04 → 0.010 (MC)
    tau_sat: 1.0, // ⬇ 6.0  → 1.0   (MC)
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
    w1: 0.1699, // ⬇ 0.22 (MC) — s_DNA
    w2: 0.0291, // ⬇ 0.20 (MC) — s_Z
    w3: 0.3252, // ⬆ 0.15 (MC) — s_E (dominante)
    w4: 0.1515, // ≈ 0.15 (MC) — s_V
    w5: 0.0273, // ⬇ 0.12 (MC) — s_X
    w6: 0.2766, // ⬆ 0.08 (MC) — s_P (Cassandra)
    w7: 0.0204, // ⬇ 0.08 (MC) — s_B
    sigma_g: 0.35,
    kappa_z: 4.0,
    b_z: 0.0,
    gamma_e: 0.7,
    kappa_v: 5.0,
    rho_v: 1.6,
    kappa_vmax: 0.75,
    // — Ignición —
    Q_base: 0.550, // ⬇ 0.700 → 0.550 (relaxed for fluidity)
    kappa_T: 0.50,
    kappa_V: 0.40,
    I_min: 0.35,
    kappa_i: 2.0,
    kappa_vb: 0.10,
    kappa_rep: 0.6,
    tau_novelty: 45.0,
    epsilon_divine: 0.25,
});
