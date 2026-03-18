import { EvolutionaryDecisionType } from '../interfaces/evolutionary-engine-interfaces.js';
/**
 * 🔍 BEHAVIORAL ANOMALY DETECTOR
 * Detecta anomalías en el comportamiento evolutivo
 * "La evolución debe ser consistente, no caótica"
 */
export interface BehavioralAnomaly {
    type: 'statistical' | 'repetition' | 'frequency' | 'consistency';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: number;
    affectedPatterns: string[];
    anomalyScore: number;
    recommendedAction: string;
}
export interface PatternStatistics {
    patternId: string;
    frequency: number;
    averageScore: number;
    standardDeviation: number;
    lastSeen: number;
    totalOccurrences: number;
}
export declare class BehavioralAnomalyDetector {
    private static redis;
    private static readonly ANOMALY_KEY;
    private static readonly BASELINE_KEY;
    private static readonly ANOMALY_THRESHOLDS;
    private static getRedis;
    /**
     * Analiza anomalías en el comportamiento evolutivo
     */
    static analyzeBehavioralAnomalies(recentDecisions: EvolutionaryDecisionType[], timeWindow?: number): Promise<BehavioralAnomaly[]>;
    /**
     * Detecta anomalías estadísticas
     */
    private static detectStatisticalAnomalies;
    /**
     * Detecta anomalías de repetición
     */
    private static detectRepetitionAnomalies;
    /**
     * Detecta anomalías de frecuencia
     */
    private static detectFrequencyAnomalies;
    /**
     * Detecta anomalías de consistencia
     */
    private static detectConsistencyAnomalies;
    /**
     * Obtiene baseline comportamental
     */
    private static getBehavioralBaseline;
    /**
     * Actualiza baseline comportamental
     */
    private static updateBehavioralBaseline;
    /**
     * Registra anomalías detectadas
     */
    private static recordAnomalies;
    /**
     * Obtiene estadísticas de anomalías
     */
    static getAnomalyStats(timeWindow?: number): Promise<{
        totalAnomalies: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
        recentAnomalies: BehavioralAnomaly[];
    }>;
    /**
     * Calcula estadísticas de patrón
     */
    private static calculatePatternStatistics;
    /**
     * Calcula score de anomalía
     */
    private static calculateAnomalyScore;
    /**
     * Calcula desviación estándar
     */
    private static calculateStandardDeviation;
    /**
     * Calcula score de consistencia
     * SSE-FIX-PURGE-AND-PATCH: Fixed false positives for new patterns without baseline
     */
    private static calculateConsistencyScore;
}
//# sourceMappingURL=behavioral-anomaly-detector.d.ts.map