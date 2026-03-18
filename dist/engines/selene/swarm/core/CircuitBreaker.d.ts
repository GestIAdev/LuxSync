/**
 * Circuit Breaker Pattern Implementation
 * Protección cuántica contra cascadas de fallos
 *
 * Estados: Closed (normal) → Open (fallando) → Half-Open (probando recovery)
 * Métricas: Failure threshold, timeout, success rate
 * Estrategias: Fast-fail, graceful degradation, auto-recovery
 */
export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",// Operación normal
    OPEN = "OPEN",// Circuito abierto - rechaza requests
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    successThreshold: number;
    timeout: number;
    monitoringWindow: number;
}
export interface CircuitBreakerMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    stateChangeTime: number;
}
export declare class CircuitBreaker {
    private name;
    private state;
    private config;
    private metrics;
    private recoveryTimer?;
    private backoffMultiplier;
    private maxBackoffTime;
    private currentBackoffTime;
    constructor(name: string, config?: Partial<CircuitBreakerConfig>);
    /**
     * Ejecuta una operación protegida por el circuit breaker
     */
    execute<T>(_operation: () => Promise<T>): Promise<T>;
    /**
     * Ejecuta operación con timeout
     */
    private executeWithTimeout;
    /**
     * Maneja éxito de operación
     */
    private onSuccess;
    /**
     * Maneja fallo de operación
     */
    private onFailure;
    /**
     * 🔥 PHASE 2.3.5: Exponential Backoff - verifica si debe intentar recuperación
     *
     * Strategy: Backoff time doubles with each consecutive failure.
     * First failure: 30s → Second: 60s → Third: 120s → Max: 300s
     *
     * Target: 2-3x faster recovery by avoiding premature retry storms
     */
    private shouldAttemptRecovery;
    /**
     * Transición a estado CLOSED
     */
    private transitionToClosed;
    /**
     * Transición a estado OPEN
     */
    private transitionToOpen;
    /**
     * Transición a estado HALF_OPEN
     */
    private transitionToHalfOpen;
    /**
     * Obtiene el estado actual
     */
    getState(): CircuitBreakerState;
    /**
     * Obtiene métricas actuales
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Obtiene configuración
     */
    getConfig(): CircuitBreakerConfig;
    /**
     * Fuerza el estado del circuit breaker
     */
    forceState(state: CircuitBreakerState): void;
    /**
     * Resetea métricas
     */
    resetMetrics(): void;
    /**
     * Destruye el circuit breaker (limpia timers)
     */
    destroy(): void;
}
/**
 * Factory para crear circuit breakers con configuraciones predefinidas
 */
export declare class CircuitBreakerFactory {
    static createNetworkBreaker(_name: string): CircuitBreaker;
    static createIntegrationBreaker(_name: string): CircuitBreaker;
    static createHealthBreaker(_name: string): CircuitBreaker;
    static createThreatBreaker(_name: string): CircuitBreaker;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map