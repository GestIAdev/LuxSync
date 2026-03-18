/**
 * 🎸 FEEDBACK ENGINE
 * Procesa feedback y ajusta pesos para evolución
 */
/**
 * FEEDBACK DEL USUARIO
 */
export interface EngineFeedback {
    tags: string[];
    rating: number;
    timestamp: number;
    metadata?: {
        generationId?: string;
        stylePreset?: string;
        duration?: number;
    };
}
/**
 * FEEDBACK PROCESADO
 * Interpretación estructurada del feedback de usuario
 */
export interface ProcessedFeedback {
    original: EngineFeedback;
    categorizedTags: CategorizedTags;
    derivedAdjustments: FeedbackAdjustments;
    confidence: number;
}
/**
 * TAGS CATEGORIZADOS
 */
export interface CategorizedTags {
    tempo: string[];
    rhythm: string[];
    harmony: string[];
    melody: string[];
    structure: string[];
    emotion: string[];
    general: string[];
}
/**
 * AJUSTES DERIVADOS DEL FEEDBACK
 */
export interface FeedbackAdjustments {
    weights: {
        tempoMultiplier?: number;
        varietyWeight?: number;
        creativityWeight?: number;
        dissonanceReduction?: number;
        complexityBoost?: number;
    };
    preferences: {
        preferredModes?: string[];
        preferredProgressions?: string[];
        preferredStyles?: string[];
        avoidedCharacteristics?: string[];
    };
    appliedAt: number;
    expiresAt?: number;
}
/**
 * LEARNING WEIGHTS
 * Pesos que evolucionan con el feedback acumulado
 */
export interface LearningWeights {
    styleWeights: Map<string, number>;
    progressionWeights: Map<string, number>;
    modeWeights: Map<string, string>;
    tempoPreference: {
        min: number;
        max: number;
        ideal: number;
    };
    complexityPreference: {
        harmonic: number;
        melodic: number;
        rhythmic: number;
    };
    totalFeedbackCount: number;
    positiveCount: number;
    negativeCount: number;
    lastUpdated: number;
}
/**
 * FEEDBACK ENGINE
 * Procesa feedback y ajusta pesos para evolución
 */
export declare class FeedbackEngine {
    private weights;
    private feedbackHistory;
    constructor();
    /**
     * Procesar feedback de usuario
     */
    processFeedback(feedback: EngineFeedback): Promise<ProcessedFeedback>;
    /**
     * Categorizar tags
     */
    private categorizeTags;
    /**
     * Derivar ajustes desde tags
     */
    private deriveAdjustments;
    /**
     * Aplicar ajustes a learning weights
     */
    private applyAdjustments;
    /**
     * Calcular confianza en interpretación
     */
    private calculateConfidence;
    /**
     * Cargar weights desde Redis
     */
    loadWeights(): Promise<void>;
    /**
     * Guardar weights en Redis
     */
    saveWeights(): Promise<void>;
    /**
     * Aplicar learning weights a generación
     */
    applyWeightsToParams(params: import('../core/interfaces.js').MusicGenerationParams): import('../core/interfaces.js').MusicGenerationParams;
    /**
     * Inicializar weights por defecto
     */
    private initializeWeights;
}
//# sourceMappingURL=FeedbackEngine.d.ts.map