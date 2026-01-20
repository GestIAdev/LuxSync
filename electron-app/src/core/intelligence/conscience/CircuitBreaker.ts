/**
 * ⚡ CIRCUIT BREAKER
 * "El Protector que previene cascading failures"
 * 
 * WAVE 900.2 - Phase 2: Ethical Core
 * 
 * @module CircuitBreaker
 * @description Sistema de protección contra sobrecarga y fallos en cascada.
 *              Conservado del EthicalCoreEngine original (DentiAgest).
 * 
 * ADAPTACIÓN:
 * - De: Proteger cálculos médicos excesivos
 * - A: Proteger GPU de sobrecarga de efectos intensos
 * 
 * ESTADOS:
 * - CLOSED: Normal operation (circuito cerrado = flujo normal)
 * - OPEN: Protection mode (circuito abierto = bloquea operaciones)
 * - HALF_OPEN: Testing recovery (permite algunas operaciones para test)
 * 
 * FILOSOFÍA:
 * "Mejor prevenir el colapso que recuperarse del desastre."
 * 
 * @author PunkOpus (Opus 4.5) - Adapted from DentiAgest EthicalCoreEngine
 * @date 2026-01-20
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number          // Fallos consecutivos antes de abrir
  successThreshold: number          // Éxitos consecutivos para cerrar
  recoveryTimeoutMs: number         // Tiempo antes de intentar HALF_OPEN
  monitorWindowMs: number           // Ventana de monitoreo de fallos
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  lastFailure: Date | null
  lastSuccess: Date | null
  nextRetryAt: Date | null
  isHealthy: boolean
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,              // 3 fallos consecutivos
  successThreshold: 2,              // 2 éxitos para recuperar
  recoveryTimeoutMs: 30000,         // 30 segundos
  monitorWindowMs: 60000            // 1 minuto
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED'
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailure: Date | null = null
  private lastSuccess: Date | null = null
  private nextRetryAt: Date | null = null
  
  private config: CircuitBreakerConfig
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    console.log(`[CIRCUIT_BREAKER] ⚡ Initialized (threshold: ${this.config.failureThreshold})`)
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Verifica si la operación puede proceder
   * @returns true si puede proceder, false si circuito está OPEN
   */
  public canProceed(): boolean {
    if (this.state === 'CLOSED') {
      return true
    }
    
    if (this.state === 'OPEN') {
      // Verificar si es momento de intentar recuperación
      if (this.nextRetryAt && Date.now() >= this.nextRetryAt.getTime()) {
        this.state = 'HALF_OPEN'
        console.log('[CIRCUIT_BREAKER] 🔄 State: OPEN → HALF_OPEN (attempting recovery)')
        return true
      }
      
      return false
    }
    
    if (this.state === 'HALF_OPEN') {
      // En HALF_OPEN permitimos operaciones pero monitoreamos
      return true
    }
    
    return false
  }
  
  /**
   * Registra un éxito
   */
  public recordSuccess(): void {
    this.lastSuccess = new Date()
    
    if (this.state === 'CLOSED') {
      // Reset failure count en operación normal
      this.failureCount = 0
      return
    }
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED'
        this.failureCount = 0
        this.successCount = 0
        this.nextRetryAt = null
        console.log('[CIRCUIT_BREAKER] ✅ State: HALF_OPEN → CLOSED (recovered)')
      }
    }
  }
  
  /**
   * Registra un fallo
   */
  public recordFailure(reason?: string): void {
    this.lastFailure = new Date()
    this.failureCount++
    
    if (reason) {
      console.warn(`[CIRCUIT_BREAKER] ⚠️ Failure recorded: ${reason}`)
    }
    
    if (this.state === 'CLOSED') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.openCircuit()
      }
    } else if (this.state === 'HALF_OPEN') {
      // Fallo en HALF_OPEN = volver a OPEN
      this.openCircuit()
    }
  }
  
  /**
   * Obtiene el estado actual
   */
  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      nextRetryAt: this.nextRetryAt,
      isHealthy: this.state === 'CLOSED'
    }
  }
  
  /**
   * Resetea el circuit breaker (para testing)
   */
  public reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailure = null
    this.lastSuccess = null
    this.nextRetryAt = null
    console.log('[CIRCUIT_BREAKER] 🔄 Reset to CLOSED')
  }
  
  /**
   * Fuerza apertura (para emergencias)
   */
  public forceOpen(reason: string): void {
    console.warn(`[CIRCUIT_BREAKER] 🚨 Force OPEN: ${reason}`)
    this.openCircuit()
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════
  
  private openCircuit(): void {
    this.state = 'OPEN'
    this.successCount = 0
    this.nextRetryAt = new Date(Date.now() + this.config.recoveryTimeoutMs)
    
    console.error(
      `[CIRCUIT_BREAKER] 🔴 State: CLOSED → OPEN (failures: ${this.failureCount}/${this.config.failureThreshold})`
    )
    console.log(
      `[CIRCUIT_BREAKER] 🕐 Next retry at: ${this.nextRetryAt.toLocaleTimeString()}`
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// TIMEOUT WRAPPER (Complemento del Circuit Breaker)
// ═══════════════════════════════════════════════════════════════

export interface TimeoutConfig {
  defaultTimeoutMs: number
  maxConcurrentOperations: number
}

export class TimeoutWrapper {
  private activeOperations: number = 0
  private config: TimeoutConfig
  
  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = {
      defaultTimeoutMs: 5000,
      maxConcurrentOperations: 5,
      ...config
    }
    console.log(`[TIMEOUT_WRAPPER] ⏱️ Initialized (timeout: ${this.config.defaultTimeoutMs}ms)`)
  }
  
  /**
   * Ejecuta operación con timeout
   */
  public async execute<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (this.activeOperations >= this.config.maxConcurrentOperations) {
      throw new Error(`Max concurrent operations reached: ${this.config.maxConcurrentOperations}`)
    }
    
    this.activeOperations++
    
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs
    
    try {
      const result = await Promise.race([
        operation(),
        this.createTimeout<T>(timeout)
      ])
      
      return result
    } finally {
      this.activeOperations--
    }
  }
  
  /**
   * Obtiene operaciones activas
   */
  public getActiveOperations(): number {
    return this.activeOperations
  }
  
  private createTimeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`))
      }, ms)
    })
  }
}
