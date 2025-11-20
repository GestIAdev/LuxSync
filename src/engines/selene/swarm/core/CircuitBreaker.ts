/**
 * Circuit Breaker Pattern Implementation
 * Protección cuántica contra cascadas de fallos
 *
 * Estados: Closed (normal) → Open (fallando) → Half-Open (probando recovery)
 * Métricas: Failure threshold, timeout, success rate
 * Estrategias: Fast-fail, graceful degradation, auto-recovery
 */


export enum CircuitBreakerState {
  CLOSED = "CLOSED", // Operación normal
  OPEN = "OPEN", // Circuito abierto - rechaza requests
  HALF_OPEN = "HALF_OPEN", // Probando recuperación
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Número de fallos consecutivos para abrir
  recoveryTimeout: number; // Tiempo en ms antes de intentar recovery
  successThreshold: number; // Número de éxitos para cerrar en half-open
  timeout: number; // Timeout por request en ms
  monitoringWindow: number; // Ventana de tiempo para métricas en ms
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

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private recoveryTimer?: NodeJS.Timeout;
  
  // 🔥 PHASE 2.3.5: Exponential Backoff for 2-3x faster recovery
  private backoffMultiplier = 2; // Double backoff each time
  private maxBackoffTime = 300000; // Max 5 minutes
  private currentBackoffTime = 0;

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {},
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 segundos
      successThreshold: 3,
      timeout: 15000, // 15 segundos - INCREASED for consciousness consensus
      monitoringWindow: 60000, // 1 minuto
      ...config,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangeTime: Date.now(),
    };
  }

  /**
   * Ejecuta una operación protegida por el circuit breaker
   */
  async execute<T>(_operation: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    // Si el circuito está abierto, rechaza inmediatamente
    if (this.state === CircuitBreakerState.OPEN) {
      // Verifica si es tiempo de intentar recovery
      if (this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(
          `CircuitBreaker ${this.name}: OPEN - Service unavailable`,
        );
      }
    }

    try {
      // Ejecuta la operación con timeout
      const result = await this.executeWithTimeout(_operation);

      // Éxito - registra métricas
      this.onSuccess();

      return result;
    } catch (error) {
      // Fallo - registra métricas
      this.onFailure();

      throw error;
    }
  }

  /**
   * Ejecuta operación con timeout
   */
  private async executeWithTimeout<T>(_operation: () => Promise<T>): Promise<T> {
    return new Promise((_resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`CircuitBreaker ${this.name}: Operation timeout`));
      }, this.config.timeout);

      _operation()
        .then((_result) => {
          clearTimeout(timeoutId);
          _resolve(_result);
        })
        .catch((_error) => {
          clearTimeout(timeoutId);
          reject(_error);
        });
    });
  }

  /**
   * Maneja éxito de operación
   */
  private onSuccess(): void {
    this.metrics.successfulRequests++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();

    // Si estamos en half-open y alcanzamos el threshold, cerramos
    if (
      this.state === CircuitBreakerState.HALF_OPEN &&
      this.metrics.consecutiveSuccesses >= this.config.successThreshold
    ) {
      this.transitionToClosed();
    }
  }

  /**
   * Maneja fallo de operación
   */
  private onFailure(): void {
    this.metrics.failedRequests++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();

    // Si alcanzamos el threshold de fallos, abrimos el circuito
    if (
      this.state === CircuitBreakerState.CLOSED &&
      this.metrics.consecutiveFailures >= this.config.failureThreshold
    ) {
      this.transitionToOpen();
    }

    // Si estamos en half-open, cualquier fallo nos devuelve a open
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  /**
   * 🔥 PHASE 2.3.5: Exponential Backoff - verifica si debe intentar recuperación
   * 
   * Strategy: Backoff time doubles with each consecutive failure.
   * First failure: 30s → Second: 60s → Third: 120s → Max: 300s
   * 
   * Target: 2-3x faster recovery by avoiding premature retry storms
   */
  private shouldAttemptRecovery(): boolean {
    const timeSinceLastFailure = Date.now() - this.metrics.lastFailureTime;
    
    // Calculate backoff time based on consecutive failures
    if (this.currentBackoffTime === 0) {
      this.currentBackoffTime = this.config.recoveryTimeout;
    } else {
      this.currentBackoffTime = Math.min(
        this.currentBackoffTime * this.backoffMultiplier,
        this.maxBackoffTime
      );
    }
    
    // Check if enough time has passed with exponential backoff
    return timeSinceLastFailure >= this.currentBackoffTime;
  }

  /**
   * Transición a estado CLOSED
   */
  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.metrics.stateChangeTime = Date.now();
    this.metrics.consecutiveFailures = 0;
    this.metrics.consecutiveSuccesses = 0;
    
    // 🔥 PHASE 2.3.5: Reset backoff on successful recovery
    this.currentBackoffTime = 0;

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }

    console.log(`🔄 CircuitBreaker ${this.name}: CLOSED - Service recovered`);
  }

  /**
   * Transición a estado OPEN
   */
  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.metrics.stateChangeTime = Date.now();

    // Programa intento de recovery
    this.recoveryTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.recoveryTimeout);

    console.log(`🚫 CircuitBreaker ${this.name}: OPEN - Service failing`);
  }

  /**
   * Transición a estado HALF_OPEN
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.metrics.stateChangeTime = Date.now();
    this.metrics.consecutiveSuccesses = 0;

    console.log(`⚡ CircuitBreaker ${this.name}: HALF_OPEN - Testing recovery`);
  }

  /**
   * Obtiene el estado actual
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Obtiene métricas actuales
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtiene configuración
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Fuerza el estado del circuit breaker
   */
  forceState(state: CircuitBreakerState): void {
    this.state = state;
    this.metrics.stateChangeTime = Date.now();
    console.log(`🔧 CircuitBreaker ${this.name}: FORCED to ${state}`);
  }

  /**
   * Resetea métricas
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangeTime: Date.now(),
    };
  }

  /**
   * Destruye el circuit breaker (limpia timers)
   */
  destroy(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }
}

/**
 * Factory para crear circuit breakers con configuraciones predefinidas
 */
export class CircuitBreakerFactory {
  static createNetworkBreaker(_name: string): CircuitBreaker {
    return new CircuitBreaker(_name, {
      failureThreshold: 3, // Más sensible para red
      recoveryTimeout: 15000, // 15s recovery
      successThreshold: 2,
      timeout: 3000, // 3s timeout
      monitoringWindow: 30000, // 30s ventana
    });
  }

  static createIntegrationBreaker(_name: string): CircuitBreaker {
    return new CircuitBreaker(_name, {
      failureThreshold: 5, // Más tolerante para integraciones
      recoveryTimeout: 60000, // 1min recovery
      successThreshold: 3,
      timeout: 10000, // 10s timeout
      monitoringWindow: 120000, // 2min ventana
    });
  }

  static createHealthBreaker(_name: string): CircuitBreaker {
    return new CircuitBreaker(_name, {
      failureThreshold: 2, // Muy sensible para health
      recoveryTimeout: 10000, // 10s recovery rápido
      successThreshold: 1,
      timeout: 2000, // 2s timeout
      monitoringWindow: 15000, // 15s ventana
    });
  }

  static createThreatBreaker(_name: string): CircuitBreaker {
    return new CircuitBreaker(_name, {
      failureThreshold: 10, // Muy tolerante para amenazas
      recoveryTimeout: 300000, // 5min recovery
      successThreshold: 5,
      timeout: 15000, // 15s timeout
      monitoringWindow: 300000, // 5min ventana
    });
  }
}


