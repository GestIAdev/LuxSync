/**
 * 🚩 PATTERN EMERGENCE FEATURE FLAGS SYSTEM
 * Sistema de activación controlada para características del Pattern Emergence Engine
 *
 * GESTIÓN DE RIESGOS:
 * - Activación gradual de características complejas
 * - Rollout controlado basado en métricas de estabilidad
 * - Fallback automático en caso de anomalías
 */
export interface PatternEmergenceFeatureFlag {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage: number;
    conditions: PatternEmergenceCondition[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    dependencies: string[];
}
export interface PatternEmergenceCondition {
    type: 'experience_count' | 'system_stability' | 'memory_pressure' | 'anomaly_rate';
    operator: 'gte' | 'lte' | 'eq' | 'between';
    value: number | [number, number];
    description: string;
}
export interface PatternEmergenceFeatureFlagsConfig {
    name: string;
    version: string;
    flags: PatternEmergenceFeatureFlag[];
    globalRiskThreshold: number;
    autoDisableOnAnomaly: boolean;
}
/**
 * 🚩 Pattern Emergence Feature Flags Manager
 * Gestiona la activación controlada de características del engine
 */
export declare class PatternEmergenceFeatureFlagsManager {
    private config;
    private flags;
    private anomalyCount;
    private lastEvaluation;
    constructor(config: PatternEmergenceFeatureFlagsConfig);
    private initializeFlags;
    /**
     * 📊 Evaluar si una feature flag está habilitada
     */
    isEnabled(flagId: string, context: {
        experienceCount: number;
        systemStability: number;
        memoryPressure: number;
        anomalyRate: number;
    }): {
        enabled: boolean;
        reason: string;
        riskAssessment: number;
    };
    /**
     * ⚠️ Reportar anomalía para auto-disable
     */
    reportAnomaly(): void;
    /**
     * ✅ Resetear contador de anomalías
     */
    resetAnomalies(): void;
    /**
     * 📈 Obtener estado actual de todas las flags
     */
    getStatus(context: {
        experienceCount: number;
        systemStability: number;
        memoryPressure: number;
        anomalyRate: number;
    }): {
        flags: Array<{
            id: string;
            enabled: boolean;
            reason: string;
            riskAssessment: number;
        }>;
        globalRisk: number;
        anomalyCount: number;
    };
    private evaluateCondition;
    private calculateRiskLevel;
    private calculateGlobalRisk;
    private disableHighRiskFeatures;
    private hashString;
}
export declare const DEFAULT_PATTERN_EMERGENCE_FEATURE_FLAGS: PatternEmergenceFeatureFlagsConfig;
//# sourceMappingURL=PatternEmergenceFeatureFlags.d.ts.map