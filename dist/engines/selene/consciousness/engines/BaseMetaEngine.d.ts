/**
 * 🛡️ BASE META ENGINE - FUNDACIÓN DE SEGURIDAD
 * Fase 0: Clase base para todos los engines de meta-consciencia
 *
 * Incluye: Circuit Breakers, Timeouts, Memory Limits, Health Monitoring
 * Forged by PunkClaude + Claude 4.5
 */
import { BaseMetaEngine, EngineConfig, EngineMetrics, EngineHealth, SafetyContext, CircuitBreakerState, ExecutionResult } from './MetaEngineInterfaces.js';
export declare abstract class BaseMetaEngineImpl implements BaseMetaEngine {
    readonly config: EngineConfig;
    readonly logger: any;
    protected metrics: EngineMetrics;
    protected circuitBreaker: CircuitBreakerState;
    protected lastExecutionTime: Date;
    private memoryLimiter;
    private timeoutWrapper;
    private healthMonitor;
    constructor(config: EngineConfig);
    /**
     * 🚀 Initialize the engine
     */
    initialize(): Promise<void>;
    /**
     * ⚡ Execute with full safety context
     */
    execute(context: SafetyContext): Promise<ExecutionResult>;
    /**
     * 📊 Get current metrics
     */
    getMetrics(): EngineMetrics;
    /**
     * ❤️ Get health status
     */
    getHealth(): Promise<EngineHealth>;
    /**
     * 🧹 Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * 🎯 Execute the actual engine logic (to be implemented by subclasses)
     */
    protected abstract executeWithSafety(context: SafetyContext): Promise<ExecutionResult>;
    /**
     * 🚀 Engine-specific initialization
     */
    protected abstract onInitialize(): Promise<void>;
    /**
     * 🧹 Engine-specific cleanup
     */
    protected abstract onCleanup(): Promise<void>;
    private validateConfig;
    private initializeSafetySystems;
    private checkCircuitBreaker;
    private recordCircuitBreakerFailure;
    private resetCircuitBreaker;
    private updateMetrics;
    private updateHealthScore;
}
//# sourceMappingURL=BaseMetaEngine.d.ts.map