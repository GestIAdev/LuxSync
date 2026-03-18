/**
 * 📊 PATTERN EMERGENCE MONITORING SYSTEM
 * Sistema de monitoreo y métricas para el Pattern Emergence Engine
 *
 * FUNCIONALIDADES:
 * - Métricas de rendimiento en tiempo real
 * - Alertas automáticas basadas en umbrales
 * - Historial de operaciones y anomalías
 * - Reportes de salud del sistema
 */
export interface PatternEmergenceMetrics {
    operationCount: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    minExecutionTime: number;
    timeoutCount: number;
    peakMemoryUsage: number;
    averageMemoryUsage: number;
    memorySpikeCount: number;
    cycleDetectionCount: number;
    anomalyDetectionCount: number;
    falsePositiveCount: number;
    patternDeduplicationCount: number;
    emergenceDetectionCount: number;
    paradigmShiftCount: number;
    metaPatternCount: number;
    correlationStrength: number;
    overallHealth: number;
    stabilityScore: number;
    anomalyRate: number;
    lastUpdate: Date;
}
export interface PatternEmergenceAlert {
    id: string;
    type: 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    context: {
        operation?: string;
        metrics?: Partial<PatternEmergenceMetrics>;
        threshold?: number;
        actualValue?: number;
    };
    resolved: boolean;
    resolutionTime?: Date;
}
export interface PatternEmergenceMonitoringConfig {
    name: string;
    version: string;
    thresholds: {
        maxExecutionTime: number;
        maxMemoryUsage: number;
        maxAnomalyRate: number;
        minStabilityScore: number;
        maxTimeoutRate: number;
    };
    metricsRetentionHours: number;
    alertRetentionHours: number;
    healthCheckIntervalMs: number;
    enableDetailedLogging: boolean;
}
/**
 * 📊 Pattern Emergence Monitoring System
 * Monitorea el rendimiento y salud del Pattern Emergence Engine
 */
export declare class PatternEmergenceMonitoringSystem {
    private config;
    private metrics;
    private alerts;
    private operationHistory;
    private healthCheckInterval?;
    constructor(config: PatternEmergenceMonitoringConfig);
    private initializeMetrics;
    /**
     * 📈 Registrar operación completada
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
    /**
     * ⚠️ Registrar anomalía detectada
     */
    recordAnomaly(type: 'cycle' | 'emergence' | 'memory' | 'performance', details: any): void;
    /**
     * ✅ Resolver alerta
     */
    resolveAlert(alertId: string, resolution: string): void;
    /**
     * 📊 Obtener métricas actuales
     */
    getCurrentMetrics(): PatternEmergenceMetrics;
    /**
     * 🚨 Obtener alertas activas
     */
    getActiveAlerts(): PatternEmergenceAlert[];
    /**
     * 📈 Obtener historial de operaciones
     */
    getOperationHistory(hours?: number): Array<{
        timestamp: Date;
        operation: string;
        duration: number;
        memoryUsage: number;
        success: boolean;
    }>;
    /**
     * 🏥 Reporte de salud del sistema
     */
    getHealthReport(): {
        overallHealth: number;
        status: 'healthy' | 'warning' | 'critical';
        issues: string[];
        recommendations: string[];
        metrics: PatternEmergenceMetrics;
    };
    /**
     * 🧹 Limpiar datos antiguos
     */
    cleanup(): void;
    private checkThresholds;
    private createAlert;
    private calculateAnomalyRate;
    private calculateStabilityScore;
    private calculateOverallHealth;
    private calculateVariance;
    private startHealthChecks;
    /**
     * 🛑 Detener monitoreo
     */
    stop(): void;
}
export declare const DEFAULT_PATTERN_EMERGENCE_MONITORING_CONFIG: PatternEmergenceMonitoringConfig;
//# sourceMappingURL=PatternEmergenceMonitoring.d.ts.map