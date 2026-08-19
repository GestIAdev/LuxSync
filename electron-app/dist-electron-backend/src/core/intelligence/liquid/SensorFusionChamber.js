/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.2 (Lote 2/3: Fusión e Ignición)
 *
 * Cámara de Fusión de Sensores — media geométrica ponderada en dominio log.
 * 7 sensores agnósticos que reemplazan los 20 vetos booleanos de V2.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §6
 */
// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════
/** Epsilon para evitar ln(0) en dominio logarítmico */
const EPSILON = 0.01;
// ═══════════════════════════════════════════════════════════════════════════
// Engine — zero-alloc, determinístico
// ═══════════════════════════════════════════════════════════════════════════
export class SensorFusionChamber {
    constructor(profile) {
        this.profile = profile;
        // Snapshot pre-asignado — reutilizado entre llamadas
        this._result = {
            confidence: 0,
            sensors: {
                s_DNA: 0, s_Z: 0, s_E: 0, s_V: 0, s_X: 0, s_P: 0, s_B: 0,
            },
        };
        // Capturamos la referencia interna para escribir sin alloc
        this._sensors = this._result.sensors;
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
    fuse(input) {
        const p = this.profile;
        // ── s_DNA — Context-Genome Resonance (WAVE 7535: Bucle 1 closure) ──
        //
        // g_ctx = ⟨Ê·CF̂, Δ, 1−Π⟩  (Energy×Crest, Dirtiness, 1−Percussiveness)
        // g_fx  = ⟨aggression, chaos, organicity⟩  (the candidate effect's DNA)
        //
        // When a candidate genome is provided (from Cassandra pre-buffer or
        // SpeciesQuotaSelector fallback), s_DNA measures the Gaussian similarity
        // between the acoustic context and the effect's genetic material:
        //
        //   s_DNA = exp(−|g_ctx − g_fx|² / (2·σ_g²))
        //
        // This peaks at 1.0 when the effect perfectly matches the room — an
        // aggressive effect in an aggressive context, an organic effect in a
        // melodic context. The sigma_g parameter (0.35) controls how forgiving
        // the match is. This closes Bucle 1: the genome now influences the
        // ignition DECISION, not just the selection.
        //
        // FALLBACK (Option A, WAVE 7527): When no genome is available (cold start,
        // no pre-buffer, empty ecosystem), s_DNA measures internal coherence —
        // the geometric mean of g_ctx components. This ensures the system never
        // starves for a genome reference.
        const ctxA = input.rawEnergy * input.crestFactor;
        const ctxC = input.dirtiness;
        const ctxO = 1 - input.percussiveness;
        let s_DNA;
        if (input.effectGenome) {
            // 🧬 WAVE 7535: Context-Genome Resonance (Gaussian similarity)
            const fx = input.effectGenome;
            const dA = ctxA - fx.aggression;
            const dC = ctxC - fx.chaos;
            const dO = ctxO - fx.organicity;
            const distSq = dA * dA + dC * dC + dO * dO;
            const twoSigmaSq = 2 * p.sigma_g * p.sigma_g;
            s_DNA = Math.exp(-distSq / twoSigmaSq);
        }
        else {
            // FALLBACK: Internal coherence (Option A, WAVE 7527)
            s_DNA = Math.exp((Math.log(Math.max(ctxA, EPSILON)) +
                Math.log(Math.max(ctxC, EPSILON)) +
                Math.log(Math.max(ctxO, EPSILON))) / 3);
        }
        // ── s_Z — Anomalía normalizada por tensión ──
        // s_Z = σ(κ_z · (I/T − 1) + b_z)
        const ratioIT = input.tension > 0.001 ? input.impact / input.tension : 0;
        const s_Z = 1 / (1 + Math.exp(-(p.kappa_z * (ratioIT - 1) + p.b_z)));
        // ── s_E — Energía líquida comprimida ──
        // s_E = Ê^γ_e
        const eHat = input.rawEnergy / Math.max(input.energyMaxHistoric, 0.01);
        const s_E = Math.pow(eHat, p.gamma_e);
        // ── s_V — Filtro espectral anti-voz ──
        // vocalDominance = σ(κ_v · (mid/(bass+ε) − ρ_v)) · (1 − CF̂)
        // s_V = 1 − κ_vmax · vocalDominance
        const midBassRatio = input.midPresence / (input.bassPresence + EPSILON);
        const vocalSig = 1 / (1 + Math.exp(-(p.kappa_v * (midBassRatio - p.rho_v))));
        const vocalDominance = vocalSig * (1 - input.crestFactor);
        const s_V = 1 - p.kappa_vmax * vocalDominance;
        // ── s_X — Excitabilidad (passthrough) ──
        const s_X = input.excitability;
        // ── s_P — Prior de Cassandra ──
        // s_P = 0.5 + 0.5 · P_aligned
        // P_aligned = prediction.probability · alignment
        const pAligned = input.predictionProbability * input.predictionAlignment;
        const s_P = 0.5 + 0.5 * pAligned;
        // ── s_B — Belleza y Consonancia ──
        // s_B = 0.6 + 0.4 · (0.6 · beauty + 0.4 · consonance)
        const s_B = 0.6 + 0.4 * (0.6 * input.totalBeauty + 0.4 * input.consonance);
        // ── Clamp todos a [ε, 1] ──
        const clamped_DNA = s_DNA < EPSILON ? EPSILON : s_DNA > 1 ? 1 : s_DNA;
        const clamped_Z = s_Z < EPSILON ? EPSILON : s_Z > 1 ? 1 : s_Z;
        const clamped_E = s_E < EPSILON ? EPSILON : s_E > 1 ? 1 : s_E;
        const clamped_V = s_V < EPSILON ? EPSILON : s_V > 1 ? 1 : s_V;
        const clamped_X = s_X < EPSILON ? EPSILON : s_X > 1 ? 1 : s_X;
        const clamped_P = s_P < EPSILON ? EPSILON : s_P > 1 ? 1 : s_P;
        const clamped_B = s_B < EPSILON ? EPSILON : s_B > 1 ? 1 : s_B;
        // ── Media geométrica en dominio log ──
        // ln C = w1·ln(s_DNA) + w2·ln(s_Z) + ... + w7·ln(s_B)
        const lnC = p.w1 * Math.log(clamped_DNA) +
            p.w2 * Math.log(clamped_Z) +
            p.w3 * Math.log(clamped_E) +
            p.w4 * Math.log(clamped_V) +
            p.w5 * Math.log(clamped_X) +
            p.w6 * Math.log(clamped_P) +
            p.w7 * Math.log(clamped_B);
        const confidence = Math.exp(lnC);
        // ── Escribir snapshot pre-asignado ──
        this._sensors.s_DNA = clamped_DNA;
        this._sensors.s_Z = clamped_Z;
        this._sensors.s_E = clamped_E;
        this._sensors.s_V = clamped_V;
        this._sensors.s_X = clamped_X;
        this._sensors.s_P = clamped_P;
        this._sensors.s_B = clamped_B;
        this._result.confidence = confidence;
        return this._result;
    }
    reset() {
        this._sensors.s_DNA = 0;
        this._sensors.s_Z = 0;
        this._sensors.s_E = 0;
        this._sensors.s_V = 0;
        this._sensors.s_X = 0;
        this._sensors.s_P = 0;
        this._sensors.s_B = 0;
        this._result.confidence = 0;
    }
}
