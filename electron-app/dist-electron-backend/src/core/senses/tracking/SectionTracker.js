/**
 * 🌊 WAVE 3504-EXT.3 — SectionTracker (Wave8AnalyzerSuite)
 *
 * Servicio que coordina los 4 analizadores Wave8 del pipeline de senses.ts.
 * Equivale al Wave8AnalyzerSuite del blueprint.
 *
 * Coordina:
 *   - SimpleRhythmDetector  (patrón rítmico, syncopation, groove)
 *   - SimpleHarmonyDetector (key, mood, temperatura)
 *   - SimpleSectionTracker  (intro/verse/chorus/drop/breakdown…)
 *   - MoodSynthesizer      (VAD emotional analysis)
 *
 * Extraído de senses.ts (WAVE 8 INTEGRATION — PHASE 3 del pipeline).
 * Sin cambios funcionales, solo encapsulado como servicio.
 *
 * Agnóstico al entorno Worker. Recibe AudioMetrics + RhythmTrackResult,
 * devuelve Wave8Output. No conoce parentPort, IPC ni SharedRingBuffer.
 *
 * WAVE 61: GenreClassifier eliminado — el vibe es selección manual del DJ
 *          via VibeManager en GAMMA. Solo se devuelve un GenreOutput neutro
 *          para compatibilidad de protocolo.
 */
import { SimpleRhythmDetector, SimpleHarmonyDetector, SimpleSectionTracker, } from '../../../workers/TrinityBridge';
import { MoodSynthesizer } from '../../../engine/musical/classification/MoodSynthesizer';
// ============================================
// NEUTRAL GENRE OUTPUT (WAVE 61)
// ============================================
/** Genera el GenreOutput neutro que sustituye al clasificador eliminado. */
function buildNeutralGenre(bpm, syncopation, hasFourOnFloor, energy) {
    return {
        primary: 'ELECTRONIC_4X4',
        secondary: null,
        confidence: 0,
        scores: { ELECTRONIC_4X4: 0.5, LATINO_TRADICIONAL: 0.5 },
        genre: 'ELECTRONIC_4X4',
        subgenre: 'none',
        features: {
            bpm,
            syncopation,
            hasFourOnFloor,
            hasDembow: false,
            trebleDensity: 0,
            has808Bass: false,
            avgEnergy: energy,
        },
        mood: 'neutral',
    };
}
// ============================================
// SectionTracker — Servicio
// ============================================
/**
 * Wave8AnalyzerSuite — coordina los 4 analizadores Wave8.
 *
 * Estado encapsulado:
 * - Instancias de SimpleRhythmDetector, SimpleHarmonyDetector,
 *   SimpleSectionTracker (stateful), MoodSynthesizer (stateful)
 *
 * Llamar setVibe() cuando el Worker recibe MessageType.SET_VIBE
 * (necesario para que SimpleSectionTracker ajuste su lógica de sección).
 */
export class SectionTracker {
    constructor() {
        this.rhythmDetector = new SimpleRhythmDetector();
        this.harmonyDetector = new SimpleHarmonyDetector();
        this.sectionTrackerInner = new SimpleSectionTracker();
        this.moodSynthesizer = new MoodSynthesizer();
    }
    /**
     * Analiza un frame completo y devuelve el output compuesto Wave8.
     *
     * @param metrics    AudioMetrics construido en el pipeline (spectrum + bpm state)
     * @param energy     Energía normalizada del frame [0-1]
     * @param beatState  Estado del beat (para MoodSynthesizer)
     * @param frameIndex Contador de frames (para diagnóstico BETA 🎵 Key logging)
     * @returns          Wave8Output con rhythm, harmony, section, genre, mood
     */
    analyze(metrics, energy, beatState, frameIndex) {
        // Wave 8 analyzers — en el mismo orden que senses.ts
        const rhythmOutput = this.rhythmDetector.analyze(metrics);
        const harmonyOutput = this.harmonyDetector.analyze(metrics);
        const sectionOutput = this.sectionTrackerInner.analyze(metrics, rhythmOutput);
        // WAVE 47.1: MoodSynthesizer — VAD emotional analysis
        const metricsForMood = {
            ...metrics,
            energy,
            beatConfidence: metrics.bpmConfidence,
            peak: energy,
            frameIndex,
        };
        const moodOutput = this.moodSynthesizer.process(metricsForMood, beatState);
        // WAVE 272: Log de key detection cada 60 frames (~6s @ 10fps)
        if (frameIndex % 60 === 0) {
            if (harmonyOutput.key) {
                console.log(`[BETA 🎵] Key Detected: ${harmonyOutput.key} ${harmonyOutput.mode}` +
                    ` (Confidence: ${harmonyOutput.confidence.toFixed(2)})`);
            }
            else {
                console.log(`[BETA ❌] Key NULL | DomFreq: ${metrics.dominantFrequency?.toFixed(0) ?? 'N/A'}Hz` +
                    ` | Energy: ${(energy * 100).toFixed(0)}%` +
                    ` | Conf: ${harmonyOutput.confidence.toFixed(2)}`);
            }
        }
        // WAVE 61: GenreOutput neutro (clasificador eliminado)
        const genreOutput = buildNeutralGenre(metrics.bpm, rhythmOutput.syncopation ?? 0, rhythmOutput.pattern === 'four_on_floor', energy);
        return {
            rhythm: rhythmOutput,
            harmony: harmonyOutput,
            section: sectionOutput,
            genre: genreOutput,
            // WAVE 1228: Solo primary es consumido (EffectDNA.organicity)
            // El resto son phantom fields sustituidos por valores estáticos.
            mood: {
                primary: moodOutput.primary,
                secondary: null,
                valence: 0,
                arousal: 0,
                dominance: 0,
                intensity: 0.5,
                stability: 1,
            },
        };
    }
    /**
     * Actualiza el vibe en SimpleSectionTracker.
     * Llamar cuando el Worker recibe MessageType.SET_VIBE.
     */
    setVibe(vibeId) {
        this.sectionTrackerInner.setVibe(vibeId);
    }
}
