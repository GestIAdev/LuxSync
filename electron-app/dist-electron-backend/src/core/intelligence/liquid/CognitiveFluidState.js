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
// EMA asimétrica para epicness — subida rápida, bajada lenta
// 🔬 WAVE 7542: Raised from 0.15 → 0.45 (Divine Resuscitation).
//   PROBLEM: The epicness EMA was the second filter in a cascade.
//   _impact already filters transients (ALPHA_IMPACT_UP=0.35, half-life
//   ~49ms / 2.2 frames). The epicness EMA at α=0.15 was re-filtering the
//   already-filtered signal, creating a cascade attenuation of 0.35×0.15
//   = 5.25% per frame. A divine spike (I(t)=0.70, T=0.43, CLIMAX) produced
//   epicness_target=0.556 but the EMA only reached 0.211 in frame 0 —
//   62% attenuation. By the time epicness caught up (~10 frames / 167ms),
//   the divine moment had passed.
//   FIX: α=0.45 (half-life ~36ms / 1.6 frames). The impact EMA is the
//   sole transient filter. The epicness EMA tracks the filtered impact
//   closely, reaching ~70% of target in 2 frames (~33ms) and ~90% in
//   4 frames (~67ms). Divine moments are detected within 50ms of the
//   impact spike, well within the 2-3 frame window of a real drop.
// α_down = 0.06: half-life ~231ms (10 frames) — mantiene epicness durante micro-valles
const ALPHA_EPIC_UP = 0.45;
const ALPHA_EPIC_DOWN = 0.06;
// 🔬 WAVE 7542: Raised from 0.08 → 0.15 (Divine Resuscitation).
// The old α=0.08 (half-life ~173ms) was too slow for genres with rapid
// section oscillations (fiesta-latina verse↔chorus every 15-20s). The
// smoothedPhaseMod never reached 1.0 during CLIMAX because the EMA was
// still catching up when the phase flipped back. With α=0.15 (half-life
// ~89ms / ~4 frames), the phaseModifier reaches ~0.95 within ~500ms of
// sustained CLIMAX, allowing epicness to reach its full potential.
const ALPHA_PHASE_MOD = 0.15;
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
        this._smoothedPhaseMod = 0.5; // EMA del phase modifier, arranca conservador
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
     * 🩸 WAVE 7549: Updates the profile WITHOUT resetting accumulated state.
     *
     * The problem: setMood() recreated CognitiveFluidState from scratch, losing
     * all accumulated fluid memory (tension, vapor pressure, excitability,
     * temperature, etc.). After a mood switch, the system needed to "warm up"
     * again from zero → minutes of SILENCE.
     *
     * This method swaps the profile in-place, preserving Ψ(t). Only T_base is
     * re-applied to tension (since it's a profile-derived baseline).
     */
    updateProfile(newProfile) {
        const oldTBase = this.profile.T_base;
        this.profile = newProfile;
        // Adjust tension baseline: shift tension by the delta in T_base
        // so the accumulated tension above baseline is preserved.
        this._tension += (newProfile.T_base - oldTBase);
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
        //
        // 🔬 WAVE 7542: DIVINE RESUSCITATION — recalibración del epicness.
        //   PROBLEM: epicness rara vez superaba 0.50 en climaxes reales de
        //   fiesta-latina. Tres factores lo aplastaban:
        //     1. effectiveTension = tension × 0.50 → baseEpicness bajo
        //     2. phaseModifier EMA α=0.08 → nunca llegaba a 1.0 en climaxes
        //        oscilantes (verse↔chorus cada 15-20s)
        //     3. sustainedEpic threshold = 0.55 → temperature rara vez > 0.55
        //        en dembow donde T oscila 0.40-0.50
        //   FIX:
        //     1. effectiveTension = tension × 0.35 (era 0.50) → baseEpicness sube
        //     2. ALPHA_PHASE_MOD = 0.15 (era 0.08) → phaseModifier llega a ~0.95
        //        en ~500ms de CLIMAX sostenido
        //     3. sustainedEpic threshold = 0.45 (era 0.55) → temperature > 0.45
        //        activa la ruta sustained en high-groove contexts
        //
        // §5.4: Vibe Friction PURGED — replaced with continuous ΠMΔG interpolation.
        //   frictionExp = 1.0 + 0.3 · Π·(1−M)
        //     High percussiveness + low melodicity (techno-like) → 1.3 (compresses)
        //     Low percussiveness or high melodicity (ambient-like) → 1.0 (no friction)
        //
        // Fase 1B (PRECISION TUNING): Energy factor gate.
        // Fase D (ARCHITECTURAL): Contextual Memory injection.
        // ─────────────────────────────────────────────────────────
        if (!input.isWarmedUp) {
            this._epicness = 0;
            this._smoothedPhaseMod = 0.5;
        }
        else {
            const energyFactor = clamp01((input.rawEnergy - 0.30) / 0.40);
            // 🔬 WAVE 7542: Lowered from 0.50 → 0.35.
            // With tension=0.45 (typical climax), effectiveTension was 0.225.
            // baseEpicness = (impact - 0.225) / (1 - 0.225) = (0.42 - 0.225) / 0.775 = 0.252
            // Now: (0.42 - 0.157) / (1 - 0.157) = 0.263 / 0.843 = 0.312 — 24% higher.
            const effectiveTension = this._tension * 0.35;
            const denom = 1.0 - effectiveTension;
            const baseEpicness = denom > 0.001
                ? clamp01((this._impact - effectiveTension) / denom)
                : 0;
            const phase = input.contextualPhase;
            const targetPhaseMod = phase === 'climax' ? 1.0
                : phase === 'building' ? 0.5
                    : phase === 'release' ? 0.7
                        : phase === 'textural' ? 0.8
                            : phase === 'intro' ? 0.3
                                : phase === 'outro' ? 0.3
                                    : phase === 'silence' ? 0.0
                                        : phase === 'valley' ? 0.2
                                            : 0.5; // unknown phase — conservative
            // Smooth phase modifier: EMA prevents instant doubling when phase flips
            this._smoothedPhaseMod += ALPHA_PHASE_MOD * (targetPhaseMod - this._smoothedPhaseMod);
            const phaseModifier = this._smoothedPhaseMod;
            let epic = clamp01(baseEpicness * energyFactor * phaseModifier);
            // ΠMΔG friction: percussive + non-melodic contexts compress the epicness curve.
            // No genre strings — pure fluid descriptor interpolation.
            const d = input.descriptors;
            const frictionExp = 1.0 + 0.3 * clamp01(d.percussiveness * (1 - clamp01(d.melodicity)));
            if (frictionExp > 1.001) {
                epic = Math.pow(epic, frictionExp);
            }
            // Sustained-energy epicness: high-groove contexts (latin-like) sustain energy
            // without spectral spikes. Temperature directly represents the epic moment.
            // Blended via max() — the dominant path wins.
            // 🔬 WAVE 7542: Lowered threshold from 0.55 → 0.45.
            // In dembow, temperature oscillates 0.40-0.50 during climaxes. The old
            // 0.55 threshold meant the sustained path NEVER activated for latin
            // genres — only techno with sustained energy > 0.55 could use it.
            // 0.45 opens the door for high-groove contexts where T=0.46-0.50.
            const sustainedEpic = clamp01((this._temperature - 0.45) / 0.35);
            const grooveGate = clamp01(d.groove * 2.0); // groove > 0.5 fully activates
            epic = Math.max(epic, sustainedEpic * energyFactor * phaseModifier * grooveGate);
            // EMA asimétrica: subida moderada, bajada lenta — estabiliza sin perder respuesta
            const alphaE = epic > this._epicness ? ALPHA_EPIC_UP : ALPHA_EPIC_DOWN;
            this._epicness += alphaE * (epic - this._epicness);
            this._epicness = clamp01(this._epicness);
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
        this._smoothedPhaseMod = 0.5;
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
