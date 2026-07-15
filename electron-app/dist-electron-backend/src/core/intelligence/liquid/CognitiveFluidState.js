/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.1 (Lote 1/4: Cimientos)
 *
 * Contenedor puro del vector de estado fluídico Ψ(t).
 * Mantiene T, μ, V, X, Θ, I, CF, epicness como primitivos.
 * Zero-alloc en hot path — snapshot pre-asignado y reutilizado.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §2, §9.2
 */
// ═══════════════════════════════════════════════════════════════════════════
// Utilidades
// ═══════════════════════════════════════════════════════════════════════════
function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}
function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
// EMA α para temperatura — vida media ~2s @ 44Hz (más rápida que descriptores)
const ALPHA_TEMP = 1 - Math.pow(2, -1 / (2.0 * 44.0));
// EMA α para energía RMS (ventana de crest factor ~350ms @ 44Hz ≈ 15 frames)
const ALPHA_RMS = 1 - Math.pow(2, -1 / 15.4);
// EMA asimétrica para impacto — subida rápida, bajada lenta
// α_up = 0.35: half-life ~36ms (1.6 frames) — responde rápido a energía real
// α_down = 0.08: half-life ~189ms (8.3 frames) — filtra spikes transitorios
// Un frame FLASHBANG (raw=0.9) mueve smoothed de 0.3→0.51, no 0.3→0.9
// Pero 3 frames sostenidos llegan a 0.54 — drops reales pasan
const ALPHA_IMPACT_UP = 0.35;
const ALPHA_IMPACT_DOWN = 0.08;
// ═══════════════════════════════════════════════════════════════════════════
// CognitiveFluidState — el vector Ψ(t) vivo
// ═══════════════════════════════════════════════════════════════════════════
export class CognitiveFluidState {
    constructor(profile) {
        this.profile = profile;
        this._viscosity = 0;
        this._vaporPressure = 0;
        this._excitability = 1; // Comienza plenamente excitable
        this._temperature = 0;
        this._impact = 0;
        this._crestFactor = 0;
        this._epicness = 0;
        // ── Estado auxiliar para dinámicas ──
        this._rmsEnergy = 0;
        this._peakEnergyWindow = 0;
        this._timeHigh = 0; // Segundos continuos con Ê > 0.70
        this._timeSinceIgnition = 999; // Segundos desde última ignición
        this._timeSinceImpact = 999; // Segundos desde último I > T·0.8
        this._lastTimestamp = 0;
        this._lastIntensity = 0;
        this._diagFrame = 0;
        // ── Snapshot pre-asignado ──
        this._snapshot = {
            tension: 0,
            viscosity: 0,
            vaporPressure: 0,
            excitability: 1,
            temperature: 0,
            impact: 0,
            crestFactor: 0,
            epicness: 0,
        };
        this._tension = profile.T_base;
    }
    /**
     * Actualiza todo el vector Ψ(t) un frame.
     * Hot path 44Hz — sin allocs, sin branches de género.
     *
     * @param input Métricas del frame
     * @param now   Timestamp en ms (determinístico, de Date.now() del llamante)
     */
    update(input, now) {
        const p = this.profile;
        const dt = this._lastTimestamp > 0 ? Math.min((now - this._lastTimestamp) / 1000, 0.1) : 0;
        this._lastTimestamp = now;
        // ─────────────────────────────────────────────────────────
        // 1. Temperatura Θ(t) — EMA rápida de energía
        // ─────────────────────────────────────────────────────────
        this._temperature += ALPHA_TEMP * (input.rawEnergy - this._temperature);
        // ─────────────────────────────────────────────────────────
        // 2. Energía RMS y pico para Factor de Cresta
        // ─────────────────────────────────────────────────────────
        this._rmsEnergy += ALPHA_RMS * (input.rawEnergy - this._rmsEnergy);
        if (input.rawEnergy > this._peakEnergyWindow) {
            this._peakEnergyWindow = input.rawEnergy;
        }
        else {
            // Decay exponencial del pico (vida media ~350ms)
            this._peakEnergyWindow *= Math.pow(0.5, dt / 0.35);
        }
        // CF̂(t) — Factor de cresta normalizado
        const cfRaw = this._rmsEnergy > 0.001
            ? this._peakEnergyWindow / this._rmsEnergy
            : 1.0;
        const cfHat = clamp01((cfRaw - 1) / (p.CF_ref - 1));
        this._crestFactor = cfHat;
        // ─────────────────────────────────────────────────────────
        // 3. Impacto I(t) — Multi-Spectral Fusion (M-SARFE Phase 4)
        //
        // When acousticReality is available, use the multi-spectral formula:
        //   I(t) = w_E·Z_total + w_low·max(0,Z_low) + w_high·max(0,Z_high)
        //         + w_CF·sigmoid(CF_high−4) + w_T·T + w_D·D
        //
        // Fallback to legacy 1D formula when no evidence:
        //   I(t) = w_z·ẑ + w_cf·CF̂ + w_e·Ê
        // ─────────────────────────────────────────────────────────
        const eHat = input.rawEnergy / Math.max(input.energyMaxHistoric, 0.01);
        if (input.acousticReality) {
            const ar = input.acousticReality;
            const zTotal = ar.zScores.total;
            const zLow = ar.zScores.low;
            const zHigh = ar.zScores.high;
            const cfHigh = ar.crestFactors.high;
            const T = ar.spectralTension;
            const D = ar.spectralDivergence;
            const rawImpact = clamp01(p.w_E * Math.max(0, Math.tanh(zTotal / p.z_ref)) +
                p.w_low * Math.max(0, Math.tanh(zLow / p.z_ref)) +
                p.w_high * Math.max(0, Math.tanh(zHigh / p.z_ref)) +
                p.w_CF * sigmoid(cfHigh - 4) +
                p.w_T * T +
                p.w_D * D);
            const alphaI = rawImpact > this._impact ? ALPHA_IMPACT_UP : ALPHA_IMPACT_DOWN;
            this._impact += alphaI * (rawImpact - this._impact);
            this._diagFrame++;
            if (this._diagFrame % 44 === 0) {
                console.log(`[FLUID-DIAG] M-SARFE impact=${this._impact.toFixed(3)} | zT=${zTotal.toFixed(2)} zL=${zLow.toFixed(2)} zH=${zHigh.toFixed(2)} cfH=${cfHigh.toFixed(2)} T=${T.toFixed(3)} D=${D.toFixed(3)} | wE=${(p.w_E * Math.max(0, Math.tanh(zTotal / p.z_ref))).toFixed(3)} wL=${(p.w_low * Math.max(0, Math.tanh(zLow / p.z_ref))).toFixed(3)} wH=${(p.w_high * Math.max(0, Math.tanh(zHigh / p.z_ref))).toFixed(3)} wCF=${(p.w_CF * sigmoid(cfHigh - 4)).toFixed(3)} wT=${(p.w_T * T).toFixed(3)} wD=${(p.w_D * D).toFixed(3)}`);
            }
        }
        else {
            const zHat = Math.tanh(input.zScore / p.z_ref);
            // Absolute Energy Gate: CF must not inject into I(t) when absolute
            // energy is below 0.15 — prevents lone piano notes from spoofing drops
            const cfContribution = input.rawEnergy > 0.15 ? p.w_cf * cfHat : 0;
            const rawImpact = clamp01(p.w_z * zHat + cfContribution + p.w_e * eHat);
            const alphaI = rawImpact > this._impact ? ALPHA_IMPACT_UP : ALPHA_IMPACT_DOWN;
            this._impact += alphaI * (rawImpact - this._impact);
        }
        // ─────────────────────────────────────────────────────────
        // 4. Viscosidad μ(t) = clamp01(w_m·M + w_f·flatness + w_h·harmonicDensity − w_p·Π)
        // ─────────────────────────────────────────────────────────
        const d = input.descriptors;
        this._viscosity = clamp01(p.w_m * d.melodicity +
            p.w_f * input.spectralFlatness +
            p.w_h * input.harmonicDensity -
            p.w_p * d.percussiveness);
        // ─────────────────────────────────────────────────────────
        // 5. Tensión Superficial T(t) — tres fuerzas (§3)
        // ─────────────────────────────────────────────────────────
        // (a) Endurecimiento por saturación
        const eHigh = eHat > 0.70 ? 1 : 0;
        this._timeHigh += dt * eHigh;
        const sSat = sigmoid(this._timeHigh / p.tau_sat - 2); // Centrado en 2·τ_sat
        const dT_rise = p.alpha_rise * Math.max(0, this._impact - this._tension) * sSat * eHigh;
        // (b) Evaporación por sequía
        const wasImpact = this._impact > this._tension * 1.15;
        if (wasImpact) {
            this._timeSinceImpact = 0;
        }
        else {
            this._timeSinceImpact += dt;
        }
        const lambdaEvap = p.lambda_0 * (1 + p.kappa_d * this._timeSinceImpact / (this._timeSinceImpact + p.D_half));
        const dT_evap = lambdaEvap * (this._tension - p.T_min);
        // (c) Relajación homeostática
        // σ̂_E aproximada por la temperatura como proxy de dispersión
        const tEq = p.T_base + p.kappa_sigma * this._temperature;
        const dT_relax = p.lambda_home * (this._tension - tEq);
        this._tension = clamp(this._tension + dT_rise - dT_evap - dT_relax, p.T_min, p.T_max);
        // ─────────────────────────────────────────────────────────
        // 6. Presión de Vapor V(t) — sed acumulada (§5)
        // ─────────────────────────────────────────────────────────
        this._timeSinceIgnition += dt;
        const noIgnition = this._timeSinceIgnition > 0.1 ? 1 : 0;
        const valleyFactor = 1 - eHat;
        this._vaporPressure = clamp(this._vaporPressure + p.beta_v * dt * noIgnition * valleyFactor, 0, 0.60);
        // ─────────────────────────────────────────────────────────
        // 7. Excitabilidad X(t) — recuperación post-disparo (§4.2)
        // ─────────────────────────────────────────────────────────
        const tauR = p.tau_min + (p.tau_max - p.tau_min) * this._viscosity * (0.5 + this._lastIntensity);
        const xTarget = 1 - Math.exp(-this._timeSinceIgnition / tauR);
        // EMA suave para evitar saltos discretos
        this._excitability += 0.3 * (xTarget - this._excitability);
        this._excitability = clamp01(this._excitability);
        // ─────────────────────────────────────────────────────────
        // 8. Epicness — ruptura relativa de la superficie, tethered to energy
        // REWRITE: effectiveTension = tension * 0.85.
        // baseEpicness = clamp01((impact - effectiveTension) / (1.0 - effectiveTension))
        // Impact must genuinely exceed 85% of current tension to generate epicness.
        // At effectiveTension=0.595 (tension=0.70), impact needs >0.595 for any epicness.
        //
        // Vibe Friction: Hard genres (techno/industrial/hardstyle/dark) apply
        // epicness^1.8 — suppresses mid-range epicness, only true peaks break through.
        // Soft genres (ambient/latina/chill) apply epicness^1.0 — no friction.
        //
        // Fase 1B (PRECISION TUNING): Energy factor gate.
        // Fase D (ARCHITECTURAL): Contextual Memory injection.
        // ─────────────────────────────────────────────────────────
        if (!input.isWarmedUp) {
            this._epicness = 0;
        }
        else {
            const energyFactor = clamp01((input.rawEnergy - 0.30) / 0.40);
            const effectiveTension = this._tension * 0.50;
            const denom = 1.0 - effectiveTension;
            const baseEpicness = denom > 0.001
                ? clamp01((this._impact - effectiveTension) / denom)
                : 0;
            const phase = input.contextualPhase;
            const phaseModifier = phase === 'climax' ? 1.0
                : phase === 'building' ? 0.5
                    : phase === 'release' ? 0.7
                        : phase === 'textural' ? 0.8
                            : phase === 'intro' ? 0.3
                                : phase === 'outro' ? 0.3
                                    : phase === 'silence' ? 0.0
                                        : phase === 'valley' ? 0.2
                                            : 0.5; // unknown phase — conservative
            let epic = clamp01(baseEpicness * energyFactor * phaseModifier);
            // Vibe friction: hard genres compress epicness curve
            const vibe = input.vibe ?? '';
            const isHardVibe = vibe.includes('techno') || vibe.includes('industrial')
                || vibe.includes('hardstyle') || vibe.includes('dark');
            if (isHardVibe) {
                epic = Math.pow(epic, 1.3);
            }
            this._epicness = clamp01(epic);
            if (this._diagFrame % 44 === 0) {
                console.log(`[FLUID-DIAG] epicness=${this._epicness.toFixed(3)} | base=${baseEpicness.toFixed(3)} impact=${this._impact.toFixed(3)} effT=${effectiveTension.toFixed(3)} tension=${this._tension.toFixed(3)} denom=${denom.toFixed(3)} E=${input.rawEnergy.toFixed(3)} eF=${energyFactor.toFixed(3)} phase=${phase} pM=${phaseModifier} vibe=${input.vibe ?? 'none'}`);
            }
        }
    }
    /**
     * Notifica que una ignición fue materializada.
     * Resetea vapor, actualiza refractariedad.
     */
    notifyIgnition(intensity, now) {
        const p = this.profile;
        this._vaporPressure *= p.kappa_vreset;
        this._timeSinceIgnition = 0;
        this._lastIntensity = clamp01(intensity);
        // El tiempo del impacto también se resetea para la evaporación
        this._timeSinceImpact = 0;
        void now; // Timestamp reservado para futura telemetría
    }
    /**
     * Devuelve el snapshot del estado sin asignar objetos nuevos.
     * El objeto retornado es reutilizado entre llamadas — no retener.
     */
    getSnapshot() {
        const s = this._snapshot;
        s.tension = this._tension;
        s.viscosity = this._viscosity;
        s.vaporPressure = this._vaporPressure;
        s.excitability = this._excitability;
        s.temperature = this._temperature;
        s.impact = this._impact;
        s.crestFactor = this._crestFactor;
        s.epicness = this._epicness;
        return this._snapshot;
    }
    // ── Accesores directos sin alloc (para uso interno del módulo liquid) ──
    get tension() { return this._tension; }
    get viscosity() { return this._viscosity; }
    get vaporPressure() { return this._vaporPressure; }
    get excitability() { return this._excitability; }
    get temperature() { return this._temperature; }
    get impact() { return this._impact; }
    get crestFactor() { return this._crestFactor; }
    get epicness() { return this._epicness; }
    reset() {
        const p = this.profile;
        this._tension = p.T_base;
        this._viscosity = 0;
        this._vaporPressure = 0;
        this._excitability = 1;
        this._temperature = 0;
        this._impact = 0;
        this._crestFactor = 0;
        this._epicness = 0;
        this._rmsEnergy = 0;
        this._peakEnergyWindow = 0;
        this._timeHigh = 0;
        this._timeSinceIgnition = 999;
        this._timeSinceImpact = 999;
        this._lastTimestamp = 0;
        this._lastIntensity = 0;
        const s = this._snapshot;
        s.tension = p.T_base;
        s.viscosity = 0;
        s.vaporPressure = 0;
        s.excitability = 1;
        s.temperature = 0;
        s.impact = 0;
        s.crestFactor = 0;
        s.epicness = 0;
    }
}
