// � CIRCUIT BREAKER - Cascading failure prevention
export class CircuitBreaker {
    state = {
        state: 'closed',
        failures: 0,
        successCount: 0,
    };
    failureThreshold = 5;
    resetTimeout = 60000; // 1 minute
    successThreshold = 2;
    name = 'CircuitBreaker';
    constructor(failureThreshold, resetTimeout, name) {
        if (failureThreshold !== undefined) {
            this.failureThreshold = failureThreshold;
        }
        if (resetTimeout !== undefined) {
            this.resetTimeout = resetTimeout;
        }
        if (name !== undefined) {
            this.name = name;
        }
    }
    /**
     * Execute with circuit breaker protection
     */
    async execute(fn) {
        if (this.state.state === 'open') {
            if (this.state.lastFailureTime &&
                Date.now() - this.state.lastFailureTime > this.resetTimeout) {
                this.state.state = 'half-open';
                this.state.successCount = 0;
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await fn();
            if (this.state.state === 'half-open') {
                this.state.successCount++;
                if (this.state.successCount >= this.successThreshold) {
                    this.state.state = 'closed';
                    this.state.failures = 0;
                }
            }
            return result;
        }
        catch (error) {
            this.state.failures++;
            this.state.lastFailureTime = Date.now();
            if (this.state.failures >= this.failureThreshold) {
                this.state.state = 'open';
            }
            throw error;
        }
    }
    /**
     * Check if circuit is open
     */
    isOpen() {
        return this.state.state === 'open';
    }
    /**
     * Get failure count
     */
    getFailures() {
        return this.state.failures;
    }
    /**
     * Reset circuit breaker
     */
    reset() {
        this.state = {
            state: 'closed',
            failures: 0,
            successCount: 0,
        };
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}
//# sourceMappingURL=CircuitBreaker.js.map