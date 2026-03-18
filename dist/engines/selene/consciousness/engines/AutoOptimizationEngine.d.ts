/**
 * 🧠 AUTO OPTIMIZATION ENGINE - VERSIÓN HÍBRIDA PUNK
 * Fase 5: Auto-Optimización Inteligente - Evoluciona o muere, pero con control humano
 *
 * "La perfección no es un destino, es un viaje eterno de optimización colaborativa"
 * — PunkGrok & Radwulf, Arquitectos de la Evolución Consciente
 *
 * ⚠️  ANTI-SIMULATION AXIOM COMPLIANT ⚠️
 * No Math.random() - Solo algoritmos deterministas basados en datos reales
 *
 * CAPACIDADES:
 * ✅ MODO MANUAL: Control humano total - Selene no sugiere nada
 * ✅ MODO HYBRID: Selene sugiere, humano aprueba - Colaboración perfecta
 * ✅ MODO AUTO: Selene libre - Construye o destruye autónomamente
 * ✅ Safety Systems Paranoid: Circuit breakers, timeouts, backups, rollbacks
 * ✅ Dashboard híbrido: Datos puros + traducción poética
 * ✅ Aprendizaje de feedback humano
 */
import { BaseMetaEngine, EngineConfig, EngineMetrics, SafetyContext, ExecutionResult, EngineHealth } from './MetaEngineInterfaces.js';
interface Optimization {
    optimizationId: string;
    targetComponent: string;
    changeType: 'parameter' | 'algorithm' | 'threshold';
    oldValue: any;
    newValue: any;
    expectedImprovement: number;
    riskLevel: number;
    appliedAt?: Date;
    status: 'pending_human' | 'applied' | 'reverted' | 'failed' | 'rejected';
    performanceImpact?: number;
    humanApproved?: boolean;
    humanApprovedBy?: string;
    abTested?: boolean;
    poeticDescription?: string;
    technicalDescription?: string;
}
interface OptimizationCycleResult {
    appliedOptimizations: Optimization[];
    performanceGains: number;
    riskAssessment: number;
    recommendations: string[];
    mode: 'manual' | 'hybrid' | 'auto';
}
export declare class AutoOptimizationEngine implements BaseMetaEngine {
    readonly config: EngineConfig;
    readonly logger: any;
    private metrics;
    private appliedOptimizations;
    private pendingSuggestions;
    private mode;
    private maxOptimizationsPerCycle;
    private rollbackThreshold;
    private lastHealthCheck;
    private dailySuggestionQuota;
    private suggestionCooldownMs;
    private lastSuggestionTime;
    private todaysSuggestions;
    private lastQuotaReset;
    private circuitBreaker;
    private timeoutWrapper;
    private stateBackup;
    private memoryLimiter;
    private redisSubscriber;
    private redisPublisher;
    constructor(config: EngineConfig);
    initialize(): Promise<void>;
    execute(context: SafetyContext): Promise<ExecutionResult<OptimizationCycleResult>>;
    /**
     * 🚀 CICLO PRINCIPAL DE OPTIMIZACIÓN HÍBRIDA
     */
    private runOptimizationCycle;
    /**
     * 🎮 MODO MANUAL: Solo Humano
     * Selene no sugiere nada - control humano total
     */
    private runManualMode;
    /**
     * 🔀 MODO HYBRID: Selene Propone, Humano Confirma
     * Colaboración perfecta - la más interesante
     */
    private runHybridMode;
    /**
     * 🔄 MODO AUTO: Free Selene
     * Selene completamente autónoma - construye o destruye
     */
    private runAutoMode;
    /**
     * 💡 GENERAR SUGERENCIAS DETERMINISTAS
     * Basado en análisis real de patrones, no aleatorio
     */
    private generateSuggestions;
    /**
     * ✅ AUTO-APROBACIÓN INTELIGENTE
     * Selene decide qué sugerencias aprobar automáticamente
     */
    private selfApprovalCheck;
    /**
     * 🎯 APLICAR OPTIMIZACIONES CON SAFETY
     */
    private applyOptimizations;
    /**
     * 🔧 APLICAR OPTIMIZACIÓN INDIVIDUAL
     */
    private hashString;
    private applySingleOptimization;
    /**
     * 🔙 ROLLBACK AUTOMÁTICO
     */
    private rollbackOptimization;
    /**
     * 🔄 ROLLBACK GENERAL
     */
    private rollbackAllOptimizations;
    /**
     * 📊 ANALIZAR PERFORMANCE ACTUAL
     */
    private analyzeCurrentPerformance;
    /**
     * 💡 GENERAR RECOMENDACIONES
     */
    private generateRecommendations;
    /**
     * 🎛️ CAMBIAR MODO DE OPTIMIZACIÓN
     */
    setMode(newMode: 'manual' | 'hybrid' | 'auto'): void;
    /**
     * 👤 APROBAR SUGERENCIA MANUALMENTE
     */
    approveSuggestion(suggestionId: string, approvedBy: string): Promise<void>;
    /**
     * ❌ RECHAZAR SUGERENCIA
     */
    rejectSuggestion(suggestionId: string, reason?: string): Promise<void>;
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats(): {
        totalOptimizations: number;
        pendingSuggestions: number;
        currentMode: string;
        appliedOptimizations: Optimization[];
        recentOptimizations: Optimization[];
    };
    /**
     * 📋 OBTENER SUGERENCIAS PENDIENTES
     */
    getPendingSuggestions(): Optimization[];
    /**
     * 🎨 OBTENER DASHBOARD DATA
     */
    getMetrics(): EngineMetrics;
    getHealth(): Promise<EngineHealth>;
    cleanup(): Promise<void>;
    /**
     * Optimize - compatibility method for orchestrator
     */
    optimize(context: SafetyContext): Promise<OptimizationCycleResult>;
    private updateMetrics;
    /**
     * 🔄 CONFIGURAR LISTENER REDIS PARA COMANDOS DEL DASHBOARD
     */
    private setupRedisListener;
    /**
     * 📤 PUBLICAR SUGERENCIAS PENDIENTES EN REDIS
     */
    private publishPendingSuggestions;
    /**
     * 🎮 MANEJAR COMANDOS DEL DASHBOARD
     */
    private handleDashboardCommand;
    /**
     * 📊 SISTEMA DE FRECUENCIA DE SUGERENCIAS
     */
    /**
     * 🔍 VERIFICAR SI PODEMOS GENERAR SUGERENCIAS
     */
    private canGenerateSuggestions;
    /**
     * 📈 ACTUALIZAR QUOTA DE SUGERENCIAS
     */
    private updateSuggestionQuota;
    /**
     * 🗓️ VERIFICAR SI ES UN NUEVO DÍA
     */
    private isNewDay;
    /**
     * 🔄 RESETEAR QUOTA DIARIA
     */
    private resetDailyQuota;
    /**
     * 📊 OBTENER ESTADO DE QUOTA
     */
    getQuotaStatus(): {
        usedToday: number;
        quotaLimit: number;
        cooldownRemaining: number;
        canGenerate: boolean;
    };
}
export {};
//# sourceMappingURL=AutoOptimizationEngine.d.ts.map