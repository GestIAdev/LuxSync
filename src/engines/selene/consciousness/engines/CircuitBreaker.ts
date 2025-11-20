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
  successThreshold: number; // Para half-open → closed
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
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private consecutiveSuccesses: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.state = {
      failures: 0,
      state: 'closed'
    };

    console.log(`🔌 Circuit Breaker "${config.name}" initialized: threshold=${config.failureThreshold}, timeout=${config.recoveryTimeoutMs}ms`);
  }

  /**
   * 🚀 Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    // Check if circuit is open
    if (this.state.state === 'open') {
      if (this.isRecoveryTimeoutExpired()) {
        // Try half-open state
        this.state.state = 'half-open';
        this.consecutiveSuccesses = 0;
        console.log(`🔄 Circuit Breaker "${this.config.name}" entering half-open state`);
      } else {
        // Still in timeout, fail fast
        return {
          success: false,
          error: new Error(`CIRCUIT_BREAKER_OPEN: ${this.config.name} is temporarily disabled`),
          state: 'open',
          shouldRetry: false
        };
      }
    }

    try {
      // Execute the operation
      const result = await operation();

      // Success - handle state transitions
      this.onSuccess();

      return {
        success: true,
        data: result,
        state: this.state.state,
        shouldRetry: false
      };

    } catch (error) {
      // Failure - handle state transitions
      this.onFailure();

      return {
        success: false,
        error: error as Error,
        state: this.state.state,
        shouldRetry: this.state.state === 'half-open'
      };
    }
  }

  /**
   * 📊 Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * 🔄 Force state change (for testing/admin purposes)
   */
  forceState(newState: 'closed' | 'open' | 'half-open'): void {
    const oldState = this.state.state;
    this.state.state = newState;

    if (newState === 'closed') {
      this.state.failures = 0;
      this.state.nextAttemptTime = undefined;
    } else if (newState === 'open') {
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeoutMs);
    }

    console.log(`⚡ Circuit Breaker "${this.config.name}" forced from ${oldState} to ${newState}`);
  }

  /**
   * 🧹 Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = {
      failures: 0,
      state: 'closed'
    };
    this.consecutiveSuccesses = 0;
    console.log(`🔄 Circuit Breaker "${this.config.name}" reset to closed state`);
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  private onSuccess(): void {
    this.state.failures = 0;

    if (this.state.state === 'half-open') {
      this.consecutiveSuccesses++;

      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        // Half-open → Closed
        this.state.state = 'closed';
        this.consecutiveSuccesses = 0;
        console.log(`✅ Circuit Breaker "${this.config.name}" recovered to closed state`);
      }
    }
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = new Date();

    if (this.state.state === 'half-open') {
      // Half-open → Open (single failure in half-open is enough)
      this.state.state = 'open';
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeoutMs);
      this.consecutiveSuccesses = 0;
      console.log(`💥 Circuit Breaker "${this.config.name}" failed in half-open, returning to open state`);
    } else if (this.state.state === 'closed' && this.state.failures >= this.config.failureThreshold) {
      // Closed → Open
      this.state.state = 'open';
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeoutMs);
      console.log(`🚨 Circuit Breaker "${this.config.name}" opened after ${this.state.failures} failures`);
    }
  }

  private isRecoveryTimeoutExpired(): boolean {
    return !this.state.nextAttemptTime || Date.now() >= this.state.nextAttemptTime.getTime();
  }
}

/**
 * 🏭 Circuit Breaker Factory - Crea circuit breakers configurados
 */
export class CircuitBreakerFactory {
  private static defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000, // 1 minute
    successThreshold: 3
  };

  /**
   * 🛠️ Create circuit breaker with custom config
   */
  static create(config: CircuitBreakerConfig): CircuitBreaker {
    return new CircuitBreaker(config);
  }

  /**
   * ⚡ Create circuit breaker with defaults
   */
  static createDefault(name: string): CircuitBreaker {
    return new CircuitBreaker({
      ...this.defaultConfig,
      name
    } as CircuitBreakerConfig);
  }

  /**
   * 🔧 Create circuit breaker for engine operations
   */
  static createForEngine(engineId: string, customConfig?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const config: CircuitBreakerConfig = {
      failureThreshold: customConfig?.failureThreshold || 3,
      recoveryTimeoutMs: customConfig?.recoveryTimeoutMs || 30000, // 30 seconds for engines
      successThreshold: customConfig?.successThreshold || 2,
      name: `Engine-${engineId}`
    };

    return new CircuitBreaker(config);
  }

  /**
   * 🌐 Create circuit breaker for orchestration operations
   */
  static createForOrchestration(orchestratorId: string): CircuitBreaker {
    const config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeoutMs: 120000, // 2 minutes for orchestration
      successThreshold: 3,
      name: `Orchestrator-${orchestratorId}`
    };

    return new CircuitBreaker(config);
  }
}


