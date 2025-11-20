// � CIRCUIT BREAKER - Cascading failure prevention

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime?: number;
  successCount: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    successCount: 0,
  };

  private failureThreshold: number = 5;
  private resetTimeout: number = 60000; // 1 minute
  private successThreshold: number = 2;
  private name: string = 'CircuitBreaker';

  constructor(failureThreshold?: number, resetTimeout?: number, name?: string) {
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
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.state === 'open') {
      if (
        this.state.lastFailureTime &&
        Date.now() - this.state.lastFailureTime > this.resetTimeout
      ) {
        this.state.state = 'half-open';
        this.state.successCount = 0;
      } else {
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
    } catch (error) {
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
  isOpen(): boolean {
    return this.state.state === 'open';
  }

  /**
   * Get failure count
   */
  getFailures(): number {
    return this.state.failures;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      successCount: 0,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}
