import { EvolutionaryDecisionType } from '../interfaces/evolutionary-engine-interfaces.js';
/**
 * 🛡️ PATTERN QUARANTINE SYSTEM
 * Sistema de cuarentena para patrones peligrosos
 * "Los patrones peligrosos deben ser aislados, no eliminados"
 */
export interface QuarantineEntry {
    patternId: string;
    decisionType: EvolutionaryDecisionType;
    quarantineReason: string;
    riskLevel: number;
    quarantinedAt: number;
    releaseCriteria: string[];
    monitoringData: any[];
}
export interface QuarantineRiskAssessment {
    shouldQuarantine: boolean;
    riskLevel: number;
    reasons: string[];
    recommendedDuration: number;
}
export declare class PatternQuarantineSystem {
    private static redis;
    private static readonly QUARANTINE_KEY;
    private static readonly QUARANTINE_THRESHOLD;
    private static readonly MAX_QUARANTINE_TIME;
    private static getRedis;
    /**
     * Evalúa riesgo de cuarentena para un patrón
     */
    static evaluateQuarantineRisk(decisionType: EvolutionaryDecisionType, context: {
        failureRate: number;
        performanceImpact: number;
        anomalyScore: number;
        feedbackScore: number;
    }): QuarantineRiskAssessment;
    /**
     * Pone en cuarentena un patrón
     */
    static quarantinePattern(patternId: string, decisionType: EvolutionaryDecisionType, riskAssessment: QuarantineRiskAssessment): Promise<boolean>;
    /**
     * Libera patrón de cuarentena
     */
    static releaseFromQuarantine(patternId: string): Promise<boolean>;
    /**
     * Obtiene estadísticas de cuarentena
     */
    static getQuarantineStats(): Promise<{
        totalQuarantined: number;
        highRiskCount: number;
        averageRiskLevel: number;
        oldestEntry: number;
        newestEntry: number;
    }>;
    /**
     * Limpia entradas expiradas de cuarentena
     */
    static cleanupExpiredQuarantine(): Promise<number>;
}
//# sourceMappingURL=pattern-quarantine-system.d.ts.map