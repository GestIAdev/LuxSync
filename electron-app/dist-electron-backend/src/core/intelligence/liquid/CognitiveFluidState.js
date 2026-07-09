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
        // 3. Impacto I(t) = w_z·ẑ + w_cf·CF̂ + w_e·Ê
        // ─────────────────────────────────────────────────────────
        const zHat = Math.tanh(input.zScore / p.z_ref);
        const eHat = input.rawEnergy / Math.max(input.energyMaxHistoric, 0.01);
        this._impact = clamp01(p.w_z * zHat + p.w_cf * cfHat + p.w_e * eHat);
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
        const wasImpact = this._impact > this._tension * 0.8;
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
        // FIX: La fórmula original (impact - tension) / tension requiere
        // impact > tension, pero con la calibración actual el impacto máximo
        // práctico (~0.42) nunca supera la tensión de equilibrio (~0.70).
        // Nueva fórmula: ruptura relativa a la MITAD de la tensión.
        // epicness=1 cuando impact=tension, epicness=0 cuando impact≤tension/2.
        //
        // Fase 1B (PRECISION TUNING): Energy factor gate.
        // Valleys (E<0.30) produce epicness=0. Vocal transients in E=0.35
        // valleys get crushed by energyFactor=0.125. Only E≥0.70 allows
        // full epicness — genuine drops/climaxes only.
        //
        // Fase D (ARCHITECTURAL): Contextual Memory injection.
        // isWarmedUp=false → epicness=0 (cold-start/post-silence protection).
        // Phase modifier: BUILDING×0.5, RELEASE×0.7, CLIMAX×1.0.
        // This is the true regulator — no arbitrary cooldowns needed.
        // ─────────────────────────────────────────────────────────
        if (!input.isWarmedUp) {
            this._epicness = 0;
        }
        else {
            const energyFactor = clamp01((input.rawEnergy - 0.30) / 0.40);
            const halfTension = this._tension * 0.5;
            const baseEpicness = halfTension > 0.001
                ? clamp01((this._impact - halfTension) / halfTension)
                : 0;
            const phase = input.contextualPhase;
            const phaseModifier = phase === 'climax' ? 1.0
                : phase === 'building' ? 0.5
                    : phase === 'release' ? 0.7
                        : phase === 'intro' ? 0.3
                            : phase === 'outro' ? 0.3
                                : 0.5; // unknown phase — conservative
            this._epicness = clamp01(baseEpicness * energyFactor * phaseModifier);
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
