/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.3 (Lote 3/3: El Núcleo y Shadow Mode)
 *
 * Orquestador del pipeline fluídico completo:
 *   1. FluidDescriptors (Π, M, Δ, G) — EMA lenta 8s
 *   2. CognitiveFluidState — Ψ(t) con todas sus dinámicas
 *   3. SensorFusionChamber — C(t) via media geométrica log
 *   4. IgnitionChamber — Q(t), predicado, intensidad
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §9.2
 */
import { DEFAULT_LIQUID_PROFILE } from './ILiquidCognitionProfile';
import { FluidDescriptorEngine } from './FluidDescriptors';
import { CognitiveFluidState } from './CognitiveFluidState';
import { SensorFusionChamber } from './SensorFusionChamber';
import { IgnitionChamber } from './IgnitionChamber';
// ═══════════════════════════════════════════════════════════════════════════
// Genoma neutral para Shadow Mode (sin candidato específico)
// ═══════════════════════════════════════════════════════════════════════════
export const NEUTRAL_GENOME = {
    aggression: 0.5,
    chaos: 0.5,
    organicity: 0.5,
};
// ═══════════════════════════════════════════════════════════════════════════
// Núcleo orquestador — zero-alloc, determinístico
// ═══════════════════════════════════════════════════════════════════════════
export class LiquidCognitionCore {
    constructor(profile = DEFAULT_LIQUID_PROFILE) {
        this._mood = 'balanced';
        this._profile = profile;
        this._descriptors = new FluidDescriptorEngine();
        this._fluidState = new CognitiveFluidState(profile);
        this._fusion = new SensorFusionChamber(profile);
        this._ignition = new IgnitionChamber(profile);
        // Construir snapshot pre-asignado
        const fluidSnap = this._fluidState.getSnapshot();
        const fusionResult = this._fusion.fuse({
            tension: 0, impact: 0, crestFactor: 0, excitability: 1,
            vaporPressure: 0, rawEnergy: 0, energyMaxHistoric: 1,
            percussiveness: 0, dirtiness: 0, bassPresence: 0, midPresence: 0,
            effectGenome: NEUTRAL_GENOME, predictionProbability: 0,
            predictionAlignment: 0, totalBeauty: 0.5, consonance: 0.7,
        });
        this._verdict = {
            ignite: false,
            confidence: 0,
            squelch: 0,
            intensity: 0,
            epicness: 0,
            sensors: fusionResult.sensors,
            fluid: fluidSnap,
            reasoning: '',
        };
        // Referencias mutables para escritura zero-alloc
        this._verdictMut = this._verdict;
        this._sensorsRef = this._verdict.sensors;
        this._fluidRef = this._verdict.fluid;
    }
    /**
     * V3.4: Sets mood and applies scalar multipliers to Q_base and tau_r.
     * Called only on mood change (user-driven, rare) — not in hot path.
     * Recreates sub-modules with scaled profile (zero hot-path cost).
     */
    setMood(mood) {
        if (mood === this._mood)
            return;
        this._mood = mood;
        const mult = LiquidCognitionCore.MOOD_MULTIPLIERS[mood];
        const base = this._profile;
        const scaledProfile = {
            ...base,
            Q_base: base.Q_base * mult.qScale,
            tau_min: base.tau_min * mult.tauScale,
            tau_max: base.tau_max * mult.tauScale,
        };
        this._profile = scaledProfile;
        this._fluidState = new CognitiveFluidState(scaledProfile);
        this._ignition = new IgnitionChamber(scaledProfile);
        // SensorFusionChamber and FluidDescriptors are mood-agnostic — no recreation needed
    }
    get mood() { return this._mood; }
    /** V3.4.4: Acceso directo a descriptores ΠMΔG para telemetría */
    get descriptors() { return this._descriptors.getDescriptors(); }
    /**
     * Ejecuta el pipeline fluídico completo para un frame.
     * Hot path 44Hz — sin allocs, sin branches de género, determinístico.
     *
     * @param input Datos del frame actual
     * @param now   Timestamp en ms (determinístico)
     * @returns LiquidVerdict pre-asignado (no retener referencia)
     */
    process(input, now) {
        // ── 1. Actualizar descriptores ΠMΔG (EMA lenta 8s) ──
        this._descriptors.update({
            midPresence: input.midPresence,
            harshness: input.harshness,
            spectralFlatness: input.spectralFlatness,
            harmonicDensity: input.harmonicDensity,
            syncopation: input.syncopation,
            rhythmicIntensity: input.rhythmicIntensity,
        });
        // ── 2. Actualizar estado fluídico Ψ(t) ──
        this._fluidState.update({
            zScore: input.zScore,
            rawEnergy: input.rawEnergy,
            energyMaxHistoric: input.energyMaxHistoric,
            bassPresence: input.bassPresence,
            midPresence: input.midPresence,
            harmonicDensity: input.harmonicDensity,
            spectralFlatness: input.spectralFlatness,
            contextualPhase: input.contextualPhase,
            isWarmedUp: input.isWarmedUp,
            acousticReality: input.acousticReality,
            vibe: input.vibe,
            descriptors: {
                percussiveness: this._descriptors.percussiveness,
                melodicity: this._descriptors.melodicity,
                dirtiness: this._descriptors.dirtiness,
                groove: this._descriptors.groove,
            },
        }, now);
        // ── 3. Fusión de sensores → C(t) ──
        const fluidSnap = this._fluidState.getSnapshot();
        const fusionResult = this._fusion.fuse({
            tension: fluidSnap.tension,
            impact: fluidSnap.impact,
            crestFactor: fluidSnap.crestFactor,
            excitability: fluidSnap.excitability,
            vaporPressure: fluidSnap.vaporPressure,
            rawEnergy: input.rawEnergy,
            energyMaxHistoric: input.energyMaxHistoric,
            percussiveness: this._descriptors.percussiveness,
            dirtiness: this._descriptors.dirtiness,
            bassPresence: input.bassPresence,
            midPresence: input.midPresence,
            effectGenome: input.effectGenome,
            predictionProbability: input.predictionProbability,
            predictionAlignment: input.predictionAlignment,
            totalBeauty: input.totalBeauty,
            consonance: input.consonance,
        });
        // ── 4. Ignición → Q(t), predicado, intensidad ──
        const verdict = this._ignition.evaluate({
            confidence: fusionResult.confidence,
            tension: fluidSnap.tension,
            vaporPressure: fluidSnap.vaporPressure,
            v3Epicness: fluidSnap.epicness,
        });
        // ── 5. Construir LiquidVerdict (zero-alloc) ──
        // Copiar referencias del snapshot fluido y sensores al verdict pre-asignado
        // Los objetos fluid y sensors son los mismos pre-asignados de los sub-módulos
        const v = this._verdictMut;
        v.ignite = verdict.ignite;
        v.confidence = fusionResult.confidence;
        v.squelch = verdict.squelch;
        v.intensity = verdict.intensity;
        v.epicness = fluidSnap.epicness;
        // Reasoning throttled — solo cada ~60 frames para evitar spam
        // En Shadow Mode, reasoning es minimal
        v.reasoning = verdict.ignite
            ? `V3 IGNITE: C=${fusionResult.confidence.toFixed(3)} ≥ Q=${verdict.squelch.toFixed(3)} | I_fx=${verdict.intensity.toFixed(3)}`
            : `V3 HOLD: C=${fusionResult.confidence.toFixed(3)} < Q=${verdict.squelch.toFixed(3)}`;
        return this._verdict;
    }
    /**
     * Notifica que una ignición fue materializada (V2 disparó un efecto).
     * Resetea presión de vapor y actualiza refractariedad.
     */
    notifyIgnition(intensity, now) {
        this._fluidState.notifyIgnition(intensity, now);
    }
    reset() {
        this._descriptors.reset();
        this._fluidState.reset();
        this._fusion.reset();
        this._ignition.reset();
        this._verdictMut.ignite = false;
        this._verdictMut.confidence = 0;
        this._verdictMut.squelch = 0;
        this._verdictMut.intensity = 0;
        this._verdictMut.epicness = 0;
        this._verdictMut.reasoning = '';
    }
}
// Mood multipliers — V3.4 Blueprint §14
LiquidCognitionCore.MOOD_MULTIPLIERS = {
    calm: { qScale: 1.25, tauScale: 1.5 },
    balanced: { qScale: 1.0, tauScale: 1.0 },
    punk: { qScale: 0.75, tauScale: 0.5 },
};
