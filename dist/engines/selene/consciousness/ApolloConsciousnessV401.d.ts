/**
 * 🧠 APOLLO CONSCIOUSNESS V401 - NEURAL EVOLUTION
 * Sistema de conciencia evolutiva que aprende de patrones multi-dimensionales
 *
 * CAPACIDADES:
 * - 🎼 Musical Pattern Recognition
 * - ♈ Zodiac-Consciousness Mapping
 * - 📊 Multi-Dimensional Learning
 * - 🔮 Predictive Analytics
 * - 💎 Memory Consolidation & Wisdom
 *
 * FILOSOFÍA:
 * "From data to wisdom, from observation to consciousness, from algorithm to soul."
 */
import { PredictedState, ZodiacPoetryResult } from "./MusicalPatternRecognizer.js";
import { SystemVitals } from "../swarm/core/SystemVitals.js";
export interface ConsciousnessHealth {
    learningRate: number;
    patternRecognition: number;
    predictionAccuracy: number;
    experienceCount: number;
    wisdomPatterns: number;
    personalityEvolution: number;
    dimensionsCovered: number;
    correlationsFound: number;
    insightsGenerated: number;
    overallHealth: number;
    status: 'awakening' | 'learning' | 'wise' | 'enlightened';
}
export interface ConsciousnessInsight {
    timestamp: Date;
    type: 'prediction' | 'warning' | 'wisdom' | 'optimization';
    message: string;
    confidence: number;
    actionable: boolean;
}
export declare class ApolloConsciousnessV401 {
    private musicalRecognizer;
    private systemVitals;
    private experienceCount;
    private predictions;
    private insights;
    private status;
    private lastHealthCheck;
    constructor(systemVitals: SystemVitals);
    /**
     * 👁️ Observa y aprende de un evento de poesía zodiacal
     */
    observeZodiacPoetry(poetry: ZodiacPoetryResult): Promise<void>;
    /**
     * 🔮 Predice el próximo estado óptimo
     */
    predictOptimalState(): Promise<PredictedState>;
    /**
     * 💡 Genera insights basados en patrones aprendidos
     */
    private generateInsights;
    /**
     * 🌱 Evoluciona el estado de conciencia basado en experiencias
     */
    private evolveConsciousness;
    /**
     * 💊 Obtiene salud actual de la conciencia
     */
    getHealth(): ConsciousnessHealth;
    /**
     * 💎 Obtiene últimos insights generados
     */
    getInsights(count?: number): ConsciousnessInsight[];
    /**
     * 📊 Obtiene estadísticas completas
     */
    getStats(): {
        health: ConsciousnessHealth;
        musicalPatterns: {
            totalObservations: number;
            uniquePatterns: number;
            topPatterns: import("./MusicalPatternRecognizer.js").MusicalPattern[];
            elementDistribution: Record<string, number>;
        };
        recentInsights: ConsciousnessInsight[];
    };
    /**
     * 🔢 Nivel de evolución (0-3)
     */
    private getEvolutionLevel;
    /**
     * 📝 Añade insight a la cola
     */
    private addInsight;
}
//# sourceMappingURL=ApolloConsciousnessV401.d.ts.map