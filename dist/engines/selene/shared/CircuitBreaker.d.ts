/**
 * 🔥 CIRCUIT BREAKER PATTERN V194
 * Directiva V194: Cirugía del Panteón - Fix #5
 *
 * PROPÓSITO: Implementar Circuit Breaker para prevenir cascadas infinitas
 * de fallas que pueden colapsar el sistema Selene completo
 *
 * PATRONES IMPLEMENTADOS:
 * - Circuit Breaker States (CLOSED, OPEN, HALF_OPEN)
 * - Failure threshold monitoring
 * - Automatic recovery attempts
 * - Cascade prevention
 * - Performance degradation detection
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
    monitoringWindow: number;
    performanceThreshold: number;
    cascadeDetectionEnabled: boolean;
}
export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    totalCalls: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    stateChanges: Array<{
        from: CircuitState;
        to: CircuitState;
        timestamp: number;
        reason: string;
    }>;
    averageResponseTime: number;
    cascadesPrevented: number;
}
export interface CircuitBreakerMetrics {
    callsInWindow: number;
    failuresInWindow: number;
    successRate: number;
    averageLatency: number;
    currentLoad: number;
}
/**
 * Implementación del Circuit Breaker Pattern
 * Previene cascadas infinitas y protege el sistema de sobrecargas
 */
export declare class CircuitBreaker {
    private name;
    private config;
    private state;
    private failures;
    private successes;
    private totalCalls;
    private lastFailureTime;
    private lastSuccessTime;
    private halfOpenCalls;
    private cascadesPrevented;
    private stateChangeHistory;
    private callWindow;
    private relatedCircuits;
    constructor(name: string, config: CircuitBreakerConfig);
    /**
     * Ejecutar operación protegida por el circuit breaker
     */
    execute<T>(_operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    /**
     * Registrar éxito de operación
     */
    private recordSuccess;
    /**
     * Registrar falla de operación
     */
    private recordFailure;
    /**
     * Agregar llamada a la ventana de monitoreo
     */
    private addToWindow;
    /**
     * Verificar si el circuito debe abrirse
     */
    private shouldOpenCircuit;
    /**
     * Verificar si se debe intentar recuperación
     */
    private shouldAttemptRecovery;
    /**
     * Transición entre estados del circuito
     */
    private transitionTo;
    /**
     * Detectar cascadas en circuitos relacionados
     */
    private detectCascade;
    /**
     * Prevenir cascada inmediata
     */
    private preventCascade;
    /**
     * Notificar a circuitos relacionados sobre cambios de estado
     */
    private notifyRelatedCircuits;
    /**
     * Recibir notificación de cambio de estado de circuito relacionado
     */
    private onRelatedCircuitStateChange;
    /**
     * Relacionar este circuito con otro para detección de cascadas
     */
    relateWith(otherCircuit: CircuitBreaker): void;
    /**
     * Obtener métricas actuales del circuito
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Obtener estadísticas completas del circuito
     */
    getStats(): CircuitBreakerStats;
    /**
     * Obtener estado actual del circuito
     */
    getState(): CircuitState;
    /**
     * Forzar reset del circuito (solo para testing/emergencias)
     */
    reset(): void;
    /**
     * Obtener nombre del circuito
     */
    getName(): string;
}
/**
 * Factory para crear circuit breakers con configuraciones predefinidas
 */
export declare class CircuitBreakerFactory {
    private static instances;
    /**
     * Configuraciones predefinidas para diferentes tipos de operaciones
     */
    private static configs;
    /**
     * Crear o obtener circuit breaker con configuración predefinida
     */
    static create(name: string, type?: keyof typeof CircuitBreakerFactory.configs): CircuitBreaker;
    /**
     * Crear circuit breaker con configuración personalizada
     */
    static createCustom(name: string, _config: CircuitBreakerConfig): CircuitBreaker;
    /**
     * Obtener circuit breaker existente
     */
    static get(_name: string): CircuitBreaker | undefined;
    /**
     * Relacionar múltiples circuit breakers para detección de cascadas
     */
    static relateCircuits(circuitNames: string[]): void;
    /**
     * Obtener estadísticas de todos los circuitos
     */
    static getAllStats(): Record<string, CircuitBreakerStats>;
    /**
     * Reset de todos los circuitos (emergencia)
     */
    static resetAll(): void;
}
export { CircuitBreaker as default };
//# sourceMappingURL=CircuitBreaker.d.ts.map