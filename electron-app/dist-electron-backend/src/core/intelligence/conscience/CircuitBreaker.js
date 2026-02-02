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
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    failureThreshold: 3, // 3 fallos consecutivos
    successThreshold: 2, // 2 éxitos para recuperar
    recoveryTimeoutMs: 30000, // 30 segundos
    monitorWindowMs: 60000 // 1 minuto
};
// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════
export class CircuitBreaker {
    constructor(config = {}) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailure = null;
        this.lastSuccess = null;
        this.nextRetryAt = null;
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log(`[CIRCUIT_BREAKER] ⚡ Initialized (threshold: ${this.config.failureThreshold})`);
    }
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    /**
     * Verifica si la operación puede proceder
     * @returns true si puede proceder, false si circuito está OPEN
     */
    canProceed() {
        if (this.state === 'CLOSED') {
            return true;
        }
        if (this.state === 'OPEN') {
            // Verificar si es momento de intentar recuperación
            if (this.nextRetryAt && Date.now() >= this.nextRetryAt.getTime()) {
                this.state = 'HALF_OPEN';
                console.log('[CIRCUIT_BREAKER] 🔄 State: OPEN → HALF_OPEN (attempting recovery)');
                return true;
            }
            return false;
        }
        if (this.state === 'HALF_OPEN') {
            // En HALF_OPEN permitimos operaciones pero monitoreamos
            return true;
        }
        return false;
    }
    /**
     * Registra un éxito
     */
    recordSuccess() {
        this.lastSuccess = new Date();
        if (this.state === 'CLOSED') {
            // Reset failure count en operación normal
            this.failureCount = 0;
            return;
        }
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.state = 'CLOSED';
                this.failureCount = 0;
                this.successCount = 0;
                this.nextRetryAt = null;
                console.log('[CIRCUIT_BREAKER] ✅ State: HALF_OPEN → CLOSED (recovered)');
            }
        }
    }
    /**
     * Registra un fallo
     */
    recordFailure(reason) {
        this.lastFailure = new Date();
        this.failureCount++;
        if (reason) {
            console.warn(`[CIRCUIT_BREAKER] ⚠️ Failure recorded: ${reason}`);
        }
        if (this.state === 'CLOSED') {
            if (this.failureCount >= this.config.failureThreshold) {
                this.openCircuit();
            }
        }
        else if (this.state === 'HALF_OPEN') {
            // Fallo en HALF_OPEN = volver a OPEN
            this.openCircuit();
        }
    }
    /**
     * Obtiene el estado actual
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
            nextRetryAt: this.nextRetryAt,
            isHealthy: this.state === 'CLOSED'
        };
    }
    /**
     * Resetea el circuit breaker (para testing)
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailure = null;
        this.lastSuccess = null;
        this.nextRetryAt = null;
        console.log('[CIRCUIT_BREAKER] 🔄 Reset to CLOSED');
    }
    /**
     * Fuerza apertura (para emergencias)
     */
    forceOpen(reason) {
        console.warn(`[CIRCUIT_BREAKER] 🚨 Force OPEN: ${reason}`);
        this.openCircuit();
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════
    openCircuit() {
        this.state = 'OPEN';
        this.successCount = 0;
        this.nextRetryAt = new Date(Date.now() + this.config.recoveryTimeoutMs);
        console.error(`[CIRCUIT_BREAKER] 🔴 State: CLOSED → OPEN (failures: ${this.failureCount}/${this.config.failureThreshold})`);
        console.log(`[CIRCUIT_BREAKER] 🕐 Next retry at: ${this.nextRetryAt.toLocaleTimeString()}`);
    }
}
export class TimeoutWrapper {
    constructor(config = {}) {
        this.activeOperations = 0;
        this.config = {
            defaultTimeoutMs: 5000,
            maxConcurrentOperations: 5,
            ...config
        };
        console.log(`[TIMEOUT_WRAPPER] ⏱️ Initialized (timeout: ${this.config.defaultTimeoutMs}ms)`);
    }
    /**
     * Ejecuta operación con timeout
     */
    async execute(operation, timeoutMs) {
        if (this.activeOperations >= this.config.maxConcurrentOperations) {
            throw new Error(`Max concurrent operations reached: ${this.config.maxConcurrentOperations}`);
        }
        this.activeOperations++;
        const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
        try {
            const result = await Promise.race([
                operation(),
                this.createTimeout(timeout)
            ]);
            return result;
        }
        finally {
            this.activeOperations--;
        }
    }
    /**
     * Obtiene operaciones activas
     */
    getActiveOperations() {
        return this.activeOperations;
    }
    createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${ms}ms`));
            }, ms);
        });
    }
}
