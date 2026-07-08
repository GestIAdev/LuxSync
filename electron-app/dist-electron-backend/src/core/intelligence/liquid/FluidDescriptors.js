/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.1 (Lote 1/4: Cimientos)
 *
 * Descriptores fluídicos agnósticos: Π (Percusividad), M (Melodicidad),
 * Δ (Suciedad), G (Groove). Los géneros son puntos en este espacio, no etiquetas.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §8
 */
// ═══════════════════════════════════════════════════════════════════════════
// Engine — EMA lenta ~8s @ 44Hz, zero-alloc
// ═══════════════════════════════════════════════════════════════════════════
/**
 * EMA α para vida media de ~8s a 44Hz.
 * EMA half-life formula: α = 1 - 2^(-1/(halfLifeFrames))
 * 8s × 44Hz = 352 frames → α ≈ 0.001968
 */
const ALPHA_SLOW = 1 - Math.pow(2, -1 / (8.0 * 44.0));
/**
 * Clamps x a [0, 1] sin branches (patrón Omniliquid).
 */
function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}
export class FluidDescriptorEngine {
    constructor() {
        // Estado interno — primitivos, zero-alloc en hot path
        this._percussiveness = 0;
        this._melodicity = 0;
        this._dirtiness = 0;
        this._groove = 0;
        // Snapshot pre-asignado para evitar GC pressure
        this._snapshot = {
            percussiveness: 0,
            melodicity: 0,
            dirtiness: 0,
            groove: 0,
        };
    }
    /**
     * Actualiza los 4 descriptores con EMA lenta.
     * Hot path 44Hz — sin allocs, sin branches de género.
     *
     * @param input Métricas del frame actual
     */
    update(input) {
        // Π — Percusividad: proxy = rhythmicIntensity (correlación con densidad de transitorios)
        // En lotes futuros se refinará con detector de crestas CF > 2/s explícito.
        const percussivenessRaw = input.rhythmicIntensity;
        // M — Melodicidad: clamp((midPresence - 0.30) / 0.40, 0, 1) — idéntico al morphFactor del Omniliquid
        const melodicityRaw = clamp01((input.midPresence - 0.30) / 0.40);
        // Δ — Suciedad: harshness × (0.5 + 0.5·flatness)
        const dirtinessRaw = input.harshness * (0.5 + 0.5 * input.spectralFlatness);
        // G — Groove: syncopation directa
        const grooveRaw = input.syncopation;
        // EMA lenta — misma α para los 4 ejes (composición química del fluido)
        this._percussiveness += ALPHA_SLOW * (percussivenessRaw - this._percussiveness);
        this._melodicity += ALPHA_SLOW * (melodicityRaw - this._melodicity);
        this._dirtiness += ALPHA_SLOW * (dirtinessRaw - this._dirtiness);
        this._groove += ALPHA_SLOW * (grooveRaw - this._groove);
    }
    /**
     * Devuelve los descriptores actuales sin asignar objetos.
     * El objeto retornado es reutilizado entre llamadas — no retener referencias.
     */
    getDescriptors() {
        ;
        this._snapshot.percussiveness = this._percussiveness;
        this._snapshot.melodicity = this._melodicity;
        this._snapshot.dirtiness = this._dirtiness;
        this._snapshot.groove = this._groove;
        return this._snapshot;
    }
    /** Acceso directo a Π sin alloc */
    get percussiveness() { return this._percussiveness; }
    /** Acceso directo a M sin alloc */
    get melodicity() { return this._melodicity; }
    /** Acceso directo a Δ sin alloc */
    get dirtiness() { return this._dirtiness; }
    /** Acceso directo a G sin alloc */
    get groove() { return this._groove; }
    reset() {
        this._percussiveness = 0;
        this._melodicity = 0;
        this._dirtiness = 0;
        this._groove = 0;
        this._snapshot.percussiveness = 0;
        this._snapshot.melodicity = 0;
        this._snapshot.dirtiness = 0;
        this._snapshot.groove = 0;
    }
}
