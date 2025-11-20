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
  failureThreshold: number; // Número de fallas antes de abrir el circuito
  recoveryTimeout: number; // Tiempo en ms antes de intentar recuperación
  halfOpenMaxCalls: number; // Máximo llamadas en estado HALF_OPEN
  monitoringWindow: number; // Ventana de tiempo para contar fallas (ms)
  performanceThreshold: number; // Threshold de tiempo de respuesta (ms)
  cascadeDetectionEnabled: boolean; // Detectar y prevenir cascadas
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
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private halfOpenCalls: number = 0;
  private cascadesPrevented: number = 0;

  private stateChangeHistory: Array<{
    from: CircuitState;
    to: CircuitState;
    timestamp: number;
    reason: string;
  }> = [];

  // Ventana deslizante para métricas
  private callWindow: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
  }> = [];

  // Registro de circuitos relacionados para detectar cascadas
  private relatedCircuits: Set<CircuitBreaker> = new Set();

  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
  ) {
    console.log(`🔥 CircuitBreaker: ${name} initialized with config:`, config);
  }

  /**
   * Ejecutar operación protegida por el circuit breaker
   */
  public async execute<T>(
    _operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    this.totalCalls++;

    try {
      // Verificar si el circuito está abierto
      if (this.state === "OPEN") {
        if (this.shouldAttemptRecovery()) {
          this.transitionTo("HALF_OPEN", "Recovery timeout reached");
        } else {
          this.cascadesPrevented++;
          console.log(
            `⚡ CircuitBreaker: ${this.name} - Call blocked (OPEN state)`,
          );

          if (fallback) {
            return await fallback();
          }
          throw new Error(`Circuit breaker ${this.name} is OPEN`);
        }
      }

      // Verificar límites en estado HALF_OPEN
      if (this.state === "HALF_OPEN") {
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          this.transitionTo("OPEN", "Half-open call limit exceeded");
          throw new Error(
            `Circuit breaker ${this.name} half-open limit exceeded`,
          );
        }
        this.halfOpenCalls++;
      }

      // Detectar cascadas antes de ejecutar
      if (this.detectCascade()) {
        this.preventCascade();
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Cascade detected in circuit ${this.name}`);
      }

      // Ejecutar operación
      const result = await _operation();
      const responseTime = Date.now() - startTime;

      this.recordSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(responseTime);

      if (fallback) {
        console.log(
          `🔄 CircuitBreaker: ${this.name} - Using fallback after failure`,
        );
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Registrar éxito de operación
   */
  private recordSuccess(responseTime: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    this.addToWindow(true, responseTime);

    // Verificar si podemos cerrar el circuito desde HALF_OPEN
    if (this.state === "HALF_OPEN") {
      this.transitionTo("CLOSED", "Successful call in half-open state");
      this.halfOpenCalls = 0;
    }

    // Verificar performance degradation
    if (responseTime > this.config.performanceThreshold) {
      console.warn(
        `⚠️ CircuitBreaker: ${this.name} - Performance degradation detected (${responseTime}ms)`,
      );
    }

    console.log(
      `✅ CircuitBreaker: ${this.name} - Success (${responseTime}ms)`,
    );
  }

  /**
   * Registrar falla de operación
   */
  private recordFailure(responseTime: number): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    this.addToWindow(false, responseTime);

    // Verificar si debemos abrir el circuito
    if (this.shouldOpenCircuit()) {
      this.transitionTo("OPEN", "Failure threshold exceeded");
      this.halfOpenCalls = 0;
    }

    console.log(
      `❌ CircuitBreaker: ${this.name} - Failure recorded (${responseTime}ms)`,
    );
  }

  /**
   * Agregar llamada a la ventana de monitoreo
   */
  private addToWindow(_success: boolean, _responseTime: number): void {
    const now = Date.now();

    this.callWindow.push({
      timestamp: now,
      success: _success,
      responseTime: _responseTime,
    });

    // Limpiar entradas fuera de la ventana de monitoreo
    const windowStart = now - this.config.monitoringWindow;
    this.callWindow = this.callWindow.filter(
      (_call) => _call.timestamp >= windowStart,
    );
  }

  /**
   * Verificar si el circuito debe abrirse
   */
  private shouldOpenCircuit(): boolean {
    // Necesitamos al menos el threshold de llamadas para evaluar
    if (this.callWindow.length < this.config.failureThreshold) {
      return false;
    }

    const recentFailures = this.callWindow.filter(
      (_call) => !_call.success,
    ).length;

    // Abrir si tenemos el número de fallas consecutivas requerido
    return recentFailures >= this.config.failureThreshold;
  }

  /**
   * Verificar si se debe intentar recuperación
   */
  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) return false;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  /**
   * Transición entre estados del circuito
   */
  private transitionTo(newState: CircuitState, reason: string): void {
    const oldState = this.state;
    this.state = newState;

    // 🔥 AGGRESSIVE LIMIT: Max 100 state changes to prevent memory leaks
    if (this.stateChangeHistory.length >= 100) {
      this.stateChangeHistory.shift(); // Remove oldest state change
    }

    this.stateChangeHistory.push({
      from: oldState,
      to: newState,
      timestamp: Date.now(),
      reason,
    });

    console.log(
      `🔄 CircuitBreaker: ${this.name} - State change: ${oldState} -> ${newState} (${reason})`,
    );

    // Notificar a circuitos relacionados sobre cambio de estado
    this.notifyRelatedCircuits(newState, reason);
  }

  /**
   * Detectar cascadas en circuitos relacionados
   */
  private detectCascade(): boolean {
    if (
      !this.config.cascadeDetectionEnabled ||
      this.relatedCircuits.size === 0
    ) {
      return false;
    }

    let openCircuits = 0;
    for (const circuit of this.relatedCircuits) {
      if (circuit.getState() === "OPEN") {
        openCircuits++;
      }
    }

    // Si hay al menos 1 circuito abierto y tenemos 2+ circuitos relacionados, considerar cascada
    return openCircuits >= 1 && this.relatedCircuits.size >= 2;
  }

  /**
   * Prevenir cascada inmediata
   */
  private preventCascade(): void {
    this.cascadesPrevented++;
    console.warn(
      `🚨 CircuitBreaker: ${this.name} - Cascade prevention activated`,
    );

    // Aplicar backoff exponencial
    const backoffTime = Math.min(
      1000 * Math.pow(2, this.cascadesPrevented),
      30000,
    );
    setTimeout(() => {
      console.log(`🔄 CircuitBreaker: ${this.name} - Cascade backoff complete`);
    }, backoffTime);
  }

  /**
   * Notificar a circuitos relacionados sobre cambios de estado
   */
  private notifyRelatedCircuits(_newState: CircuitState, _reason: string): void {
    for (const circuit of this.relatedCircuits) {
      circuit.onRelatedCircuitStateChange(this.name, _newState, _reason);
    }
  }

  /**
   * Recibir notificación de cambio de estado de circuito relacionado
   */
  private onRelatedCircuitStateChange(
    _circuitName: string,
    newState: CircuitState,
    _reason: string,
  ): void {
    console.log(
      `📡 CircuitBreaker: ${this.name} - Related circuit ${_circuitName} changed to ${newState}`,
    );

    // Si un circuito relacionado se abre, aumentar vigilancia
    if (newState === "OPEN" && this.state === "CLOSED") {
      console.log(
        `⚠️ CircuitBreaker: ${this.name} - Increased vigilance due to related circuit failure`,
      );
    }
  }

  /**
   * Relacionar este circuito con otro para detección de cascadas
   */
  public relateWith(otherCircuit: CircuitBreaker): void {
    this.relatedCircuits.add(otherCircuit);
    otherCircuit.relatedCircuits.add(this);
    console.log(
      `🔗 CircuitBreaker: ${this.name} related with ${otherCircuit.name}`,
    );
  }

  /**
   * Obtener métricas actuales del circuito
   */
  public getMetrics(): CircuitBreakerMetrics {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;
    const windowCalls = this.callWindow.filter(
      (_call) => _call.timestamp >= windowStart,
    );

    const successes = windowCalls.filter((_call) => _call.success).length;
    const totalResponseTime = windowCalls.reduce(
      (_sum, _call) => _sum + _call.responseTime,
      0,
    );

    return {
      callsInWindow: windowCalls.length,
      failuresInWindow: windowCalls.length - successes,
      successRate: windowCalls.length > 0 ? successes / windowCalls.length : 1,
      averageLatency:
        windowCalls.length > 0 ? totalResponseTime / windowCalls.length : 0,
      currentLoad: windowCalls.length / (this.config.monitoringWindow / 1000), // calls per second
    };
  }

  /**
   * Obtener estadísticas completas del circuito
   */
  public getStats(): CircuitBreakerStats {
    const metrics = this.getMetrics();

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChanges: [...this.stateChangeHistory],
      averageResponseTime: metrics.averageLatency,
      cascadesPrevented: this.cascadesPrevented,
    };
  }

  /**
   * Obtener estado actual del circuito
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Forzar reset del circuito (solo para testing/emergencias)
   */
  public reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;
    this.callWindow = [];
    this.lastFailureTime = null;
    this.lastSuccessTime = null;

    console.log(`🔄 CircuitBreaker: ${this.name} - Manual reset performed`);
  }

  /**
   * Obtener nombre del circuito
   */
  public getName(): string {
    return this.name;
  }
}

/**
 * Factory para crear circuit breakers con configuraciones predefinidas
 */
export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  /**
   * Configuraciones predefinidas para diferentes tipos de operaciones
   */
  private static configs = {
    // Para operaciones críticas del sistema
    critical: {
      failureThreshold: 3,
      recoveryTimeout: 60000, // 1 minuto
      halfOpenMaxCalls: 2,
      monitoringWindow: 30000, // 30 segundos
      performanceThreshold: 1000, // 1 segundo
      cascadeDetectionEnabled: true,
    },

    // Para operaciones de base de datos
    database: {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 segundos
      halfOpenMaxCalls: 3,
      monitoringWindow: 60000, // 1 minuto
      performanceThreshold: 2000, // 2 segundos
      cascadeDetectionEnabled: true,
    },

    // Para operaciones de red/API
    network: {
      failureThreshold: 10,
      recoveryTimeout: 15000, // 15 segundos
      halfOpenMaxCalls: 5,
      monitoringWindow: 45000, // 45 segundos
      performanceThreshold: 5000, // 5 segundos
      cascadeDetectionEnabled: true,
    },

    // Para operaciones tolerantes a fallas
    tolerant: {
      failureThreshold: 20,
      recoveryTimeout: 10000, // 10 segundos
      halfOpenMaxCalls: 10,
      monitoringWindow: 120000, // 2 minutos
      performanceThreshold: 10000, // 10 segundos
      cascadeDetectionEnabled: false,
    },
  };

  /**
   * Crear o obtener circuit breaker con configuración predefinida
   */
  public static create(
    name: string,
    type: keyof typeof CircuitBreakerFactory.configs = "critical",
  ): CircuitBreaker {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const config = this.configs[type];
    const circuitBreaker = new CircuitBreaker(name, config);
    this.instances.set(name, circuitBreaker);

    console.log(
      `🏭 CircuitBreakerFactory: Created ${type} circuit breaker '${name}'`,
    );
    return circuitBreaker;
  }

  /**
   * Crear circuit breaker con configuración personalizada
   */
  public static createCustom(
    name: string,
    _config: CircuitBreakerConfig,
  ): CircuitBreaker {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const circuitBreaker = new CircuitBreaker(name, _config);
    this.instances.set(name, circuitBreaker);

    console.log(
      `🏭 CircuitBreakerFactory: Created custom circuit breaker '${name}'`,
    );
    return circuitBreaker;
  }

  /**
   * Obtener circuit breaker existente
   */
  public static get(_name: string): CircuitBreaker | undefined {
    return this.instances.get(_name);
  }

  /**
   * Relacionar múltiples circuit breakers para detección de cascadas
   */
  public static relateCircuits(circuitNames: string[]): void {
    const circuits = circuitNames
      .map((_name) => this.instances.get(_name))
      .filter(Boolean) as CircuitBreaker[];

    for (let i = 0; i < circuits.length; i++) {
      for (let j = i + 1; j < circuits.length; j++) {
        circuits[i].relateWith(circuits[j]);
      }
    }

    console.log(
      `🔗 CircuitBreakerFactory: Related circuits: ${circuitNames.join(", ")}`,
    );
  }

  /**
   * Obtener estadísticas de todos los circuitos
   */
  public static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, circuit] of this.instances) {
      stats[name] = circuit.getStats();
    }

    return stats;
  }

  /**
   * Reset de todos los circuitos (emergencia)
   */
  public static resetAll(): void {
    for (const circuit of this.instances.values()) {
      circuit.reset();
    }
    console.log("🚨 CircuitBreakerFactory: All circuits reset");
  }
}

export { CircuitBreaker as default };


