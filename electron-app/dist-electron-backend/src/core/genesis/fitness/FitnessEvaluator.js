// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA III: Fitness Evaluator (Passive Survival)
// ═══════════════════════════════════════════════════════════════════════════
//  Implements the fitness equation from the blueprint — WITHOUT R_veto.
//
//  PARADIGM SHIFT (Era III):
//    Veto L2 is ABOLISHED in live evaluation. The operator selects mutations
//    manually post-show via a future UI. Fitness in live = 100% passive survival.
//
//  Equation (simplified, no veto):
//    ΔF(m, c_now) = R_customs(m) + R_context(m)
//    F_new(m) = (1 − λ) · F_old(m) · γ^(Δt_days) + λ · ΔF(m, c_now)
//
//  Constants:
//    λ = 0.15 (EMA learning rate)
//    γ = 0.99 (temporal decay — 1%/day inactivity)
//    w_dm = +0.30, w_gk = +0.20, w_rej = −0.40
//    w_ctx = +0.25, τ = 0.5
//    α = [0.30, 0.22, 0.15, 0.13, 0.10, 0.10] (6D context weights)
//
//  Herencia (birth fitness):
//    F_birth(child) = F(parent) · β_inherit · rarity_bonus(child.tier)
//    β_inherit = 0.40
// ═══════════════════════════════════════════════════════════════════════════
import { getGenesisVault } from '../GenesisVaultService';
import { RARITY_BONUS } from '../loot/RarityEngine';
// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const LAMBDA = 0.15; // EMA learning rate
const GAMMA = 0.99; // temporal decay per day
const BETA_INHERIT = 0.40; // heredity factor
const W_DM = 0.30; // weight: chosen by DecisionMaker
const W_GK = 0.20; // weight: passed gates
const W_REJ = -0.40; // weight: rejected by gate
const W_CTX = 0.25; // weight: context coherence
const TAU = 0.5; // softmax temperature for context distance
const ALPHA_6D = [0.30, 0.22, 0.15, 0.13, 0.10, 0.10];
const MS_PER_DAY = 86400000;
// ─── PURE FUNCTIONS ─────────────────────────────────────────────────────────
/**
 * R_customs: Approval by the cognitive pipeline.
 * +0.30 if chosen by DecisionMaker, +0.20 if passed gates, −0.40 if rejected.
 */
export function evaluateCustoms(c) {
    return ((c.chosenByDecisionMaker ? W_DM : 0) +
        (c.passedGates ? W_GK : 0) +
        (c.rejectedByGate ? W_REJ : 0));
}
/**
 * Encodes a HeatmapContext into a 6D numeric vector for distance computation.
 */
function encodeContext6D(ctx) {
    return [
        ctx.z_score_avg_3s,
        ctx.low_band_avg_3s,
        hashStringTo01(ctx.energy_phase),
        hashStringTo01(ctx.vibe_id),
        hashStringTo01(ctx.section_id),
        hashStringTo01(ctx.texture),
    ];
}
function hashStringTo01(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return ((h >>> 0) % 10000) / 10000;
}
/**
 * Computes the weighted 6D distance between current context and a historical heatmap.
 */
export function contextDistance6D(current, historical) {
    const histVec = encodeContext6D(historical);
    const curVec = [
        current.zScoreAvg3s,
        current.lowBandAvg3s,
        current.energyPhaseEncoded,
        current.vibeHash,
        current.sectionEncoded,
        current.textureEncoded,
    ];
    let sum = 0;
    for (let i = 0; i < 6; i++) {
        const diff = curVec[i] - histVec[i];
        sum += ALPHA_6D[i] * diff * diff;
    }
    return Math.sqrt(sum);
}
/**
 * R_context: Contextual coherence based on 6D similarity to historical heatmaps.
 * Uses softmax(−d/τ) weighted by survival_rate.
 *
 * @param current Current 6D context vector
 * @param heatmaps Array of historical heatmap contexts with survival rates
 */
export function evaluateContext(current, heatmaps) {
    if (heatmaps.length === 0)
        return 0;
    // Compute softmax weights from negative distances
    const distances = heatmaps.map((h) => contextDistance6D(current, h.context));
    const negDists = distances.map((d) => -d / TAU);
    // Softmax (numerically stable)
    const maxNeg = Math.max(...negDists);
    const exps = negDists.map((nd) => Math.exp(nd - maxNeg));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    let weightedSum = 0;
    for (let i = 0; i < heatmaps.length; i++) {
        const softmaxWeight = exps[i] / sumExps;
        weightedSum += softmaxWeight * heatmaps[i].survivalRate;
    }
    return W_CTX * weightedSum;
}
/**
 * Computes the full ΔF (delta fitness) for a fire event.
 * No R_veto — passive survival only.
 *
 * @param customs Customs evaluation (DM choice + gate pass)
 * @param current Current 6D context
 * @param heatmaps Historical heatmap contexts with survival rates
 */
export function computeDeltaF(customs, current, heatmaps) {
    return evaluateCustoms(customs) + evaluateContext(current, heatmaps);
}
/**
 * Applies EMA + temporal decay to produce the new fitness score.
 *
 * F_new = (1 − λ) · F_old · γ^(Δt_days) + λ · ΔF
 *
 * @param oldFitness Previous fitness score
 * @param deltaF New fitness delta from this event
 * @param lastEvaluatedMs Timestamp of last evaluation (ms epoch), or null if first
 * @param nowMs Current timestamp (ms epoch)
 */
export function applyEMA(oldFitness, deltaF, lastEvaluatedMs, nowMs) {
    let decayedOld = oldFitness;
    if (lastEvaluatedMs != null) {
        const daysElapsed = (nowMs - lastEvaluatedMs) / MS_PER_DAY;
        decayedOld = oldFitness * Math.pow(GAMMA, daysElapsed);
    }
    return (1 - LAMBDA) * decayedOld + LAMBDA * deltaF;
}
/**
 * Computes the birth fitness for a newborn organism inheriting from a champion parent.
 *
 * F_birth(child) = F(parent) · β_inherit · rarity_bonus(child.tier)
 */
export function computeBirthFitness(parentFitness, childTier) {
    return parentFitness * BETA_INHERIT * RARITY_BONUS[childTier];
}
// ─── DB UPDATE SERVICE ──────────────────────────────────────────────────────
/**
 * Updates an organism's fitness score in the database.
 * Also increments trials/passes counters.
 */
export function updateFitnessInDB(vault, organismId, newFitness, survived) {
    const db = vault.getDb();
    const now = Date.now();
    db.prepare(`UPDATE lfx_organisms
     SET fitness_score = @fitness,
         trials_count = trials_count + 1,
         passes_count = passes_count + @passInc,
         last_evaluated_at = @now
     WHERE organism_id = @id`).run({
        fitness: newFitness,
        passInc: survived ? 1 : 0,
        now,
        id: organismId,
    });
}
// ─── CONVENIENCE: FULL EVALUATION CYCLE ─────────────────────────────────────
/**
 * Runs a complete fitness evaluation cycle for a single fire event.
 *
 * 1. Reads current organism state from DB
 * 2. Computes ΔF from customs + context
 * 3. Applies EMA + temporal decay
 * 4. Writes back to DB
 *
 * @param organismId The organism that was fired
 * @param customs Whether it was chosen by DM and passed gates
 * @param currentCtx Current 6D context vector
 * @param heatmaps Historical heatmap contexts for similarity matching
 * @param vault Optional vault instance (defaults to singleton)
 */
export function evaluateFireEvent(organismId, customs, currentCtx, heatmaps, vault) {
    const v = vault ?? getGenesisVault();
    const db = v.getDb();
    const row = db.prepare('SELECT fitness_score, trials_count, passes_count, last_evaluated_at FROM lfx_organisms WHERE organism_id = ?').get(organismId);
    if (!row) {
        throw new Error(`[FitnessEvaluator] Organism not found: ${organismId}`);
    }
    const deltaF = computeDeltaF(customs, currentCtx, heatmaps);
    const now = Date.now();
    const newFitness = applyEMA(row.fitness_score, deltaF, row.last_evaluated_at, now);
    // Passive survival: if it was fired and we're evaluating, it survived
    // (veto is abolished in live — operator selects post-show)
    updateFitnessInDB(v, organismId, newFitness, true);
    return {
        organismId,
        deltaF,
        newFitness,
        trialsCount: row.trials_count + 1,
        passesCount: row.passes_count + 1,
    };
}
