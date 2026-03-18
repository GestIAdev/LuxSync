/**
 * 🎸 VITALS INTEGRATION ENGINE
 * Traduce estado del sistema a decisiones musicales
 */
import { VitalSigns, EmotionalMood } from '../core/types.js';
import { StylePreset } from '../style/StylePreset.js';
import { ModalScale } from '../core/interfaces.js';
/**
 * MAPEO DE VITALS A PARÁMETROS MUSICALES
 * Convierte estado del sistema en decisiones artísticas
 */
export interface VitalsToMusicMapper {
    stressMapping: StressMapping;
    harmonyMapping: HarmonyMapping;
    creativityMapping: CreativityMapping;
    influenceStrength: number;
}
/**
 * MAPEO DE STRESS
 * Stress alto → Música más tensa, rápida, densa
 */
export interface StressMapping {
    tempoMultiplier: (stress: number) => number;
    dissonanceBoost: (stress: number) => number;
    rhythmDensityBoost: (stress: number) => number;
    intensityBoost: (stress: number) => number;
}
/**
 * MAPEO DE HARMONY (Armonía del sistema)
 * Harmony alto → Música más consonante, suave
 */
export interface HarmonyMapping {
    consonanceBoost: (harmony: number) => number;
    modePreference: (harmony: number) => ModalScale;
    chordSimplification: (harmony: number) => number;
    textureSmoothing: (harmony: number) => number;
}
/**
 * MAPEO DE CREATIVITY
 * Creativity alto → Música más experimental, variada
 */
export interface CreativityMapping {
    entropyBoost: (creativity: number) => number;
    motifVariationBoost: (creativity: number) => number;
    progressionComplexity: (creativity: number) => number;
    ornamentationLevel: (creativity: number) => string;
}
/**
 * ESTADO EMOCIONAL DERIVADO
 * Interpretación de alto nivel de los vitals
 */
export interface EmotionalState {
    primary: EmotionalMood;
    secondary?: EmotionalMood;
    intensity: number;
    transition?: {
        from: EmotionalMood;
        to: EmotionalMood;
        progress: number;
    };
}
/**
 * VITALS INTEGRATION ENGINE
 * Traduce estado del sistema a decisiones musicales
 */
export declare class VitalsIntegrationEngine {
    private mapper;
    private previousState?;
    constructor(influenceStrength?: number);
    /**
     * Aplicar influencia de vitals a estilo
     */
    applyVitalsToStyle(style: StylePreset, vitals: VitalSigns): StylePreset;
    /**
     * Detectar estado emocional desde vitals
     */
    private detectEmotionalState;
    /**
     * Generar ajustes de modo desde vitals
     */
    generateModeAdjustments(vitals: VitalSigns): Partial<import('../core/types.js').ModeConfig>;
    /**
     * Crear mapper por defecto
     */
    private createDefaultMapper;
}
/**
 * COHERENCE ENGINE
 * Asegura que MIDI y Poetry reflejen el mismo estado emocional
 */
export declare class CoherenceEngine {
    /**
     * Validar coherencia entre MIDI y Poetry
     */
    validateCoherence(midiMetadata: import('../core/interfaces.js').MusicEngineOutput['metadata'], poetry: import('../core/interfaces.js').MusicEngineOutput['poetry'], vitals: VitalSigns): CoherenceReport;
    /**
     * Analizar mood de MIDI
     */
    private analyzeMIDIMood;
    /**
     * Analizar mood de Poetry
     */
    private analyzePoetryMood;
    /**
     * Calcular coherencia
     */
    private calculateCoherence;
    private detectEmotionalFromVitals;
    private identifyIssues;
}
export interface CoherenceReport {
    coherenceScore: number;
    emotionalState: EmotionalMood;
    midiMood: EmotionalMood;
    poetryMood: EmotionalMood;
    issues: string[];
}
//# sourceMappingURL=VitalsIntegrationEngine.d.ts.map