/**
 * 🔌 CIRCUIT BREAKER PATTERN - Protección contra fallos en cascada
 * Fase 0: Implementación reutilizable del patrón Circuit Breaker
 *
 * Estados: Closed (normal) → Open (protegido) → Half-Open (probando)
 * Forged by PunkClaude + Claude 4.5
 */
import { CircuitBreakerState } from './MetaEngineInterfaces.js';
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    successThreshold: number;
    name: string;
}
export interface CircuitBreakerResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    state: 'closed' | 'open' | 'half-open';
    shouldRetry: boolean;
}
/**
 * 🛡️ Circuit Breaker Pattern Implementation
 */
export declare class CircuitBreaker {
    private config;
    private state;
    private consecutiveSuccesses;
    constructor(config: CircuitBreakerConfig);
    /**
     * 🚀 Execute operation with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<CircuitBreakerResult<T>>;
    /**
     * 📊 Get current state
     */
    getState(): CircuitBreakerState;
    /**
     * 🔄 Force state change (for testing/admin purposes)
     */
    forceState(newState: 'closed' | 'open' | 'half-open'): void;
    /**
     * 🧹 Reset circuit breaker to initial state
     */
    reset(): void;
    private onSuccess;
    private onFailure;
    private isRecoveryTimeoutExpired;
}
/**
 * 🏭 Circuit Breaker Factory - Crea circuit breakers configurados
 */
export declare class CircuitBreakerFactory {
    private static defaultConfig;
    /**
     * 🛠️ Create circuit breaker with custom config
     */
    static create(config: CircuitBreakerConfig): CircuitBreaker;
    /**
     * ⚡ Create circuit breaker with defaults
     */
    static createDefault(name: string): CircuitBreaker;
    /**
     * 🔧 Create circuit breaker for engine operations
     */
    static createForEngine(engineId: string, customConfig?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * 🌐 Create circuit breaker for orchestration operations
     */
    static createForOrchestration(orchestratorId: string): CircuitBreaker;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map