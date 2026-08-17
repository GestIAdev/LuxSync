/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.1 (Lote 1/4: Cimientos)
 *
 * Descriptores fluídicos agnósticos: Π (Percusividad), M (Melodicidad),
 * Δ (Suciedad), G (Groove). Los géneros son puntos en este espacio, no etiquetas.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §8
 *
 * Π ahora se deriva del TRUE CREST DETECTOR (CrestDetector.ts): un proceso de
 * conteo de crestas CF>2 con estimador de tasa de Poisson. El proxy
 * `rhythmicIntensity` queda retirado del cómputo (era una magnitud, no una
 * densidad).
 */
import { CrestDetector, MultiBandCrestDetector } from './CrestDetector';
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
/** Pesos de fusión multibanda [low, mid, high] — kick / cuerpo / hats */
const BAND_WEIGHTS = [0.45, 0.20, 0.35];
/** Clamp del dt para robustez frente a jitter/pausas del hilo (≤100ms) */
const DT_MAX = 0.1;
export class FluidDescriptorEngine {
    constructor() {
        // Estado interno — primitivos, zero-alloc en hot path
        this._percussiveness = 0;
        this._melodicity = 0;
        this._dirtiness = 0;
        this._groove = 0;
        // TRUE CREST DETECTOR — proceso de conteo para Π
        this._crest = new CrestDetector();
        this._crestBands = new MultiBandCrestDetector(BAND_WEIGHTS);
        this._lastTimestamp = 0;
        this._crestEvent = false;
        this._crestRate = 0;
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
     * @param now   Timestamp en ms (determinístico, del llamante)
     */
    update(input, now) {
        // dt derivado del reloj del llamante (mismo idioma que CognitiveFluidState)
        const dtRaw = this._lastTimestamp > 0 ? (now - this._lastTimestamp) / 1000 : 0;
        const dt = dtRaw > DT_MAX ? DT_MAX : (dtRaw < 0 ? 0 : dtRaw);
        this._lastTimestamp = now;
        const tSec = now / 1000;
        // Π — Percusividad: TRUE CREST DETECTOR. Tasa de eventos CF>2 estimada con
        // kernel de Poisson y normalizada por saturación de Hill. Sustituye al proxy
        // `rhythmicIntensity` (WAVE 7003.1 línea 91 — TODO descargado).
        // Si hay energías por banda, la superposición de procesos independientes da
        // una densidad de transitorios estrictamente más fiel (kick + hat = 2).
        const bands = input.bandEnergies;
        const useBands = bands !== undefined && bands.length === BAND_WEIGHTS.length;
        const percussivenessRaw = useBands
            ? this._crestBands.tick(bands, tSec, dt)
            : this._crest.tick(input.rawEnergy, tSec, dt);
        this._crestEvent = useBands ? this._crestBands.event : this._crest.event;
        this._crestRate = useBands ? this._crestBands.rate : this._crest.rate;
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
    /**
     * 🪟 Flag de transitorio real (CF>2) del frame actual, latencia cero.
     * Evidencia física directa — candidato a alimentar el Glass Break Sensor
     * y el filtro anti-voz s_V (una voz sostenida tiene tasa de cresta ≈ 0,
     * aunque un master hipercomprimido muestre un NIVEL de CF engañoso).
     */
    get crestEvent() { return this._crestEvent; }
    /** R(t) — crestas CF>2 por segundo, pre-normalización (telemetría) */
    get crestRate() { return this._crestRate; }
    reset() {
        this._percussiveness = 0;
        this._melodicity = 0;
        this._dirtiness = 0;
        this._groove = 0;
        this._crest.reset();
        this._crestBands.reset();
        this._lastTimestamp = 0;
        this._crestEvent = false;
        this._crestRate = 0;
        this._snapshot.percussiveness = 0;
        this._snapshot.melodicity = 0;
        this._snapshot.dirtiness = 0;
        this._snapshot.groove = 0;
    }
}
