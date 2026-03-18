/**
 * 🧠 SANITY CHECK ENGINE
 * Verifica cordura de la IA evolutiva
 * "La creatividad sin cordura es locura peligrosa"
 */
import { EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';
export interface SanityAssessment {
    sanityLevel: number;
    concerns: string[];
    recommendations: string[];
    requiresIntervention: boolean;
    interventionType: 'none' | 'monitoring' | 'pause' | 'shutdown';
}
export declare class SanityCheckEngine {
    private static readonly SANITY_THRESHOLDS;
    /**
     * Evalúa cordura de la evolución
     */
    static assessEvolutionSanity(context: EvolutionContext): SanityAssessment;
    /**
     * Evalúa estabilidad del sistema
     */
    private static assessSystemStability;
    /**
     * Evalúa consistencia de feedback humano
     */
    private static assessFeedbackConsistency;
    /**
     * Evalúa diversidad de decisiones generadas
     */
    private static assessDecisionDiversity;
    /**
     * Calcula diferencia entre dos patrones
     */
    private static calculatePatternDifference;
    /**
     * Calcula diferencia entre secuencias
     */
    private static calculateSequenceDifference;
    /**
     * Evalúa riesgo acumulado
     */
    private static assessAccumulatedRisk;
    /**
     * Evalúa patrones de evolución
     */
    private static assessEvolutionPatterns;
    /**
     * Detecta repetición de patrones
     */
    private static detectPatternRepetition;
    /**
     * Calcula tendencia de creatividad
     */
    private static calculateCreativityTrend;
    /**
     * Calcula nivel de cordura general
     */
    private static calculateSanityLevel;
    /**
     * Determina tipo de intervención requerida
     */
    private static determineInterventionType;
    /**
     * Ejecuta intervención de cordura
     */
    static executeSanityIntervention(assessment: SanityAssessment, context: EvolutionContext): Promise<boolean>;
}
//# sourceMappingURL=sanity-check-engine.d.ts.map