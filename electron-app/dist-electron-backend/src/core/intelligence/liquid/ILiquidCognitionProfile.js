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
    T_base: 0.400, // ⬇ 0.600 → 0.400 — homeostatic target drops to ~0.40-0.48, lets tension relax in techno minimal
    kappa_sigma: 0.20, // tEq = T_base + 0.20*temp stays in [0.40, 0.57]
    alpha_rise: 0.010, // ⬇ 0.04 → 0.010 (MC)
    tau_sat: 1.0, // ⬇ 6.0  → 1.0   (MC)
    lambda_0: 0.008,
    kappa_d: 2.5,
    D_half: 8.0,
    lambda_home: 0.020, // ⬆ 0.015 → 0.020 — faster homeostatic pull toward lower T_base
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
    w_m: 0.50, // FIX: 0.40→0.50 — aumentar peso de melodicidad para μ no colapse en techno
    w_f: 0.25,
    w_h: 0.20,
    w_p: 0.10, // FIX: 0.30→0.10 — w_p=0.30 dominaba en techno (Π~0.6-0.9) y forzaba μ=0.000
    beta_v: 0.015, // ⬇ 0.03 → 0.015 (Fase 3: slower vapor accumulation in valleys)
    kappa_vreset: 0.15,
    // — Fusión —
    w1: 0.1699, // ⬇ 0.22 (MC) — s_DNA
    w2: 0.0291, // ⬇ 0.20 (MC) — s_Z
    w3: 0.4518, // ⬆ 0.3252+0.1266 (Fase 5: Cassandra weight redistributed to s_E)
    w4: 0.1515, // ≈ 0.15 (MC) — s_V
    w5: 0.0273, // ⬇ 0.12 (MC) — s_X
    w6: 0.1500, // ⬇ 0.2766 → 0.15 (Fase 5: Cassandra inflated base confidence)
    w7: 0.0204, // ⬇ 0.08 (MC) — s_B
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
    rho_v: 1.2, // ⬇ 1.6 → 1.2 (Fase 4: anti-voice triggers earlier)
    kappa_vmax: 0.90, // ⬆ 0.75 → 0.90 (Fase 4: harder vocal penalty)
    // — Ignición —
    Q_base: 0.650, // ⬆ 0.550 → 0.650 (reverted from artificial lower; was 0.700 original)
    kappa_T: 0.50,
    kappa_V: 0.40,
    I_min: 0.35,
    kappa_i: 2.0,
    kappa_vb: 0.10,
    kappa_rep: 0.6,
    tau_novelty: 45.0,
    epsilon_divine: 0.60, // ⬆ 0.40 → 0.60 (radical high-pass: only devastating impact qualifies)
});
