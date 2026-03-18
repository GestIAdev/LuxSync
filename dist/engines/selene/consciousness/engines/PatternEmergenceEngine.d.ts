/**
 * 🧠 PATTERN EMERGENCE ENGINE - PHASE 2
 * Fase 5: Detección de meta-patrones - Encuentra patrones en los patrones
 *
 * "Los patrones emergen de patrones, creando complejidad infinita"
 * — PunkClaude, Arquitecto de la Emergencia
 *
 * ⚠️  ANTI-SIMULATION AXIOM COMPLIANT ⚠️
 * No Math.random() - Solo algoritmos deterministas basados en datos reales
 */
import { BaseMetaEngine, EngineConfig, EngineMetrics, SafetyContext, ExecutionResult, EngineHealth, EmergenceAnalysis, StateBackup } from './MetaEngineInterfaces.js';
export declare class PatternEmergenceEngine implements BaseMetaEngine {
    readonly config: EngineConfig;
    readonly logger: any;
    private metrics;
    private observationWindows;
    private lastHealthCheck;
    private circuitBreakerFailures;
    private readonly MAX_OBSERVATIONS;
    private readonly MAX_MEMORY_MB;
    private readonly MAX_EXECUTION_TIME_MS;
    private featureFlagsManager;
    private monitoringSystem;
    private observationHistory;
    private patternCache;
    private cycleDetectionWindow;
    private anomalyThreshold;
    private stateBackups;
    private readonly MAX_BACKUPS;
    private lastBackupTime;
    constructor(config: EngineConfig);
    initialize(): Promise<void>;
    execute(context: SafetyContext): Promise<ExecutionResult<EmergenceAnalysis>>;
    private validateSafetyLimits;
    private performEmergenceAnalysis;
    private calculateComplexityLevel;
    private detectEmergenceIndicators;
    private detectUnexpectedCorrelations;
    private detectEmergentComplexity;
    private calculateCorrelation;
    private detectParadigmShifts;
    private identifyMetaPatterns;
    private getSystemDataFingerprint;
    private hashString;
    private hashDataStructure;
    private addObservation;
    private detectLearningCycles;
    private findCycleLength;
    private detectAnomalies;
    private deduplicatePatterns;
    private applyAntiRecursionFilter;
    getMetrics(): EngineMetrics;
    getHealth(): Promise<EngineHealth>;
    cleanup(): Promise<void>;
    /**
     * Analyze patterns - compatibility method for orchestrator
     */
    analyzePatterns(context: SafetyContext): Promise<EmergenceAnalysis>;
    /**
     * Obtener estado de feature flags
     */
    getFeatureFlagsStatus(context: {
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
    /**
     * Verificar si una feature flag específica está habilitada
     */
    isFeatureEnabled(flagId: string, context: {
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
     * Obtener métricas del sistema de monitoring
     */
    getMonitoringMetrics(): import("./PatternEmergenceMonitoring.js").PatternEmergenceMetrics;
    /**
     * Obtener reporte de salud del sistema de monitoring
     */
    getMonitoringHealth(): {
        overallHealth: number;
        status: "healthy" | "warning" | "critical";
        issues: string[];
        recommendations: string[];
        metrics: import("./PatternEmergenceMonitoring.js").PatternEmergenceMetrics;
    };
    /**
     * Obtener alertas activas del sistema de monitoring
     */
    getActiveAlerts(): import("./PatternEmergenceMonitoring.js").PatternEmergenceAlert[];
    /**
     * Resolver una alerta del sistema de monitoring
     */
    resolveAlert(alertId: string, resolution: string): void;
    /**
     * Reportar anomalía al sistema de monitoring
     */
    reportAnomaly(type: 'cycle' | 'emergence' | 'memory' | 'performance', details: any): void;
    /**
     * Registrar operación en el sistema de monitoring
     */
    recordOperation(operation: {
        name: string;
        duration: number;
        memoryUsage: number;
        success: boolean;
        timeout?: boolean;
        cyclesDetected?: number;
        anomaliesDetected?: number;
        emergencesDetected?: number;
    }): void;
    createBackup(): Promise<string>;
    restoreBackup(backupId: string): Promise<boolean>;
    getAvailableBackups(): string[];
    getBackupInfo(backupId: string): StateBackup | null;
    private updateMetrics;
    private createStateBackup;
    private restoreStateBackup;
    private generateDeterministicId;
    runChaosTest(testType: 'memory' | 'performance' | 'infinite-loop' | 'circuit-breaker' | 'full'): Promise<any>;
    private testMemoryLimits;
    private testPerformanceLimits;
    private testInfiniteLoopPrevention;
    private testCircuitBreakerActivation;
    private runFullChaosSuite;
}
//# sourceMappingURL=PatternEmergenceEngine.d.ts.map