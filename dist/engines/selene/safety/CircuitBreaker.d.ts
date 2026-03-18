export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailureTime?: number;
    successCount: number;
}
export declare class CircuitBreaker {
    private state;
    private failureThreshold;
    private resetTimeout;
    private successThreshold;
    private name;
    constructor(failureThreshold?: number, resetTimeout?: number, name?: string);
    /**
     * Execute with circuit breaker protection
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Check if circuit is open
     */
    isOpen(): boolean;
    /**
     * Get failure count
     */
    getFailures(): number;
    /**
     * Reset circuit breaker
     */
    reset(): void;
    /**
     * Get current state
     */
    getState(): CircuitBreakerState;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map