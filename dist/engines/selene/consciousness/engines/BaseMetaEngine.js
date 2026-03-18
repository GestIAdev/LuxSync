/**
 * 🛡️ BASE META ENGINE - FUNDACIÓN DE SEGURIDAD
 * Fase 0: Clase base para todos los engines de meta-consciencia
 *
 * Incluye: Circuit Breakers, Timeouts, Memory Limits, Health Monitoring
 * Forged by PunkClaude + Claude 4.5
 */
export class BaseMetaEngineImpl {
    config;
    logger;
    metrics;
    circuitBreaker;
    lastExecutionTime;
    // Safety systems
    memoryLimiter;
    timeoutWrapper;
    healthMonitor;
    constructor(config) {
        this.config = config;
        this.metrics = {
            operationsCount: 0,
            averageExecutionTime: 0,
            memoryUsage: 0,
            errorCount: 0,
            lastExecutionTime: new Date(),
            healthScore: 100
        };
        this.circuitBreaker = {
            failures: 0,
            state: 'closed'
        };
        this.lastExecutionTime = new Date();
        // Initialize safety systems
        this.memoryLimiter = new MemoryLimiter(config.maxMemoryMB);
        this.timeoutWrapper = new TimeoutWrapper(this.logger);
        this.healthMonitor = new HealthMonitor(this.config.id, this.logger);
        console.log(`🛡️ BaseMetaEngine initialized: ${config.name} v${config.version}`);
    }
    /**
     * 🚀 Initialize the engine
     */
    async initialize() {
        try {
            console.log(`🚀 Initializing ${this.config.name}...`);
            // Validate configuration
            this.validateConfig();
            // Initialize safety systems
            await this.initializeSafetySystems();
            // Engine-specific initialization
            await this.onInitialize();
            console.log(`✅ ${this.config.name} initialized successfully`);
        }
        catch (error) {
            console.error(`💥 Failed to initialize ${this.config.name}:`, error);
            throw error;
        }
    }
    /**
     * ⚡ Execute with full safety context
     */
    async execute(context) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        try {
            // Check circuit breaker
            if (!this.checkCircuitBreaker()) {
                throw new Error(`CIRCUIT_BREAKER_OPEN: Engine ${this.config.id} is temporarily disabled`);
            }
            // Check memory limits
            const memoryCheck = this.memoryLimiter.checkMemory();
            if (memoryCheck.status === 'critical') {
                throw new Error(`MEMORY_LIMIT_EXCEEDED: ${memoryCheck.usage.toFixed(2)}MB used`);
            }
            // Execute with timeout wrapper
            const result = await this.timeoutWrapper.execute(() => this.executeWithSafety(context), context.timeoutMs, `${this.config.id}_execution`, context.correlationId);
            // Update metrics
            this.updateMetrics(startTime, startMemory, true);
            // Reset circuit breaker on success
            this.resetCircuitBreaker();
            return result;
        }
        catch (error) {
            // Update metrics on failure
            this.updateMetrics(startTime, startMemory, false);
            // Update circuit breaker on failure
            this.recordCircuitBreakerFailure();
            console.error(`💥 Execution failed for ${this.config.id}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error) || 'Unknown execution error'),
                executionTime: Date.now() - startTime,
                memoryUsed: process.memoryUsage().heapUsed - startMemory,
                correlationId: context.correlationId
            };
        }
    }
    /**
     * 📊 Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * ❤️ Get health status
     */
    async getHealth() {
        const issues = [];
        // Check memory health
        const memoryCheck = this.memoryLimiter.checkMemory();
        if (memoryCheck.status !== 'ok') {
            issues.push({
                type: 'memory',
                severity: memoryCheck.status === 'critical' ? 'critical' : 'high',
                description: `Memory usage: ${memoryCheck.usage.toFixed(2)}MB (${memoryCheck.status})`,
                recommendation: 'Consider memory optimization or increase limits'
            });
        }
        // Check circuit breaker health
        if (this.circuitBreaker.state === 'open') {
            issues.push({
                type: 'stability',
                severity: 'high',
                description: `Circuit breaker is open (${this.circuitBreaker.failures} failures)`,
                recommendation: 'Engine is temporarily disabled due to repeated failures'
            });
        }
        // Check performance health
        if (this.metrics.averageExecutionTime > this.config.timeoutMs * 0.8) {
            issues.push({
                type: 'performance',
                severity: 'medium',
                description: `Average execution time (${this.metrics.averageExecutionTime.toFixed(0)}ms) near timeout limit`,
                recommendation: 'Consider performance optimization'
            });
        }
        // Calculate health score
        let healthScore = 100;
        for (const issue of issues) {
            switch (issue.severity) {
                case 'low':
                    healthScore -= 5;
                    break;
                case 'medium':
                    healthScore -= 15;
                    break;
                case 'high':
                    healthScore -= 30;
                    break;
                case 'critical':
                    healthScore -= 50;
                    break;
            }
        }
        const status = healthScore >= 80 ? 'healthy' :
            healthScore >= 60 ? 'degraded' :
                healthScore >= 40 ? 'unhealthy' : 'critical';
        return {
            status,
            score: Math.max(0, healthScore),
            issues,
            lastCheck: new Date()
        };
    }
    /**
     * 🧹 Cleanup resources
     */
    async cleanup() {
        try {
            console.log(`🧹 Cleaning up ${this.config.name}...`);
            // Engine-specific cleanup
            await this.onCleanup();
            // Cleanup safety systems
            this.memoryLimiter.cleanup();
            this.timeoutWrapper.cleanup();
            await this.healthMonitor.cleanup();
            console.log(`✅ ${this.config.name} cleanup completed`);
        }
        catch (error) {
            console.error(`💥 Cleanup failed for ${this.config.name}:`, error);
        }
    }
    // ===========================================
    // PRIVATE METHODS - SAFETY SYSTEMS
    // ===========================================
    validateConfig() {
        if (!this.config.id || !this.config.name) {
            throw new Error('INVALID_CONFIG: Engine id and name are required');
        }
        if (this.config.maxMemoryMB <= 0 || this.config.timeoutMs <= 0) {
            throw new Error('INVALID_CONFIG: Memory and timeout limits must be positive');
        }
        if (this.config.circuitBreakerThreshold <= 0) {
            throw new Error('INVALID_CONFIG: Circuit breaker threshold must be positive');
        }
    }
    async initializeSafetySystems() {
        // Initialize health monitoring
        await this.healthMonitor.initialize();
        console.log('🛡️ Safety systems initialized');
    }
    checkCircuitBreaker() {
        if (this.circuitBreaker.state === 'open') {
            if (this.circuitBreaker.nextAttemptTime &&
                Date.now() < this.circuitBreaker.nextAttemptTime.getTime()) {
                return false; // Still in timeout
            }
            // Try half-open state
            this.circuitBreaker.state = 'half-open';
            console.warn(`🔄 Circuit breaker half-open for ${this.config.id}`);
        }
        return true;
    }
    recordCircuitBreakerFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = new Date();
        if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
            this.circuitBreaker.state = 'open';
            this.circuitBreaker.nextAttemptTime = new Date(Date.now() + 60000); // 1 minute timeout
            console.error(`🚨 CIRCUIT BREAKER OPENED for ${this.config.id} after ${this.circuitBreaker.failures} failures`);
        }
    }
    resetCircuitBreaker() {
        if (this.circuitBreaker.failures > 0) {
            this.circuitBreaker.failures = 0;
            this.circuitBreaker.state = 'closed';
            this.circuitBreaker.nextAttemptTime = undefined;
            console.log(`✅ Circuit breaker reset for ${this.config.id}`);
        }
    }
    updateMetrics(startTime, startMemory, success) {
        const executionTime = Date.now() - startTime;
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;
        this.metrics.operationsCount++;
        this.metrics.lastExecutionTime = new Date();
        // Update average execution time
        const totalTime = this.metrics.averageExecutionTime * (this.metrics.operationsCount - 1) + executionTime;
        this.metrics.averageExecutionTime = totalTime / this.metrics.operationsCount;
        this.metrics.memoryUsage = memoryUsed;
        if (!success) {
            this.metrics.errorCount++;
        }
        // Update health score based on recent performance
        this.updateHealthScore(success, executionTime, memoryUsed);
    }
    updateHealthScore(success, executionTime, memoryUsed) {
        let score = this.metrics.healthScore;
        if (success) {
            score = Math.min(100, score + 1); // Small improvement on success
        }
        else {
            score = Math.max(0, score - 10); // Significant penalty on failure
        }
        // Penalty for slow execution
        if (executionTime > this.config.timeoutMs * 0.9) {
            score = Math.max(0, score - 5);
        }
        // Penalty for high memory usage
        if (memoryUsed > this.config.maxMemoryMB * 1024 * 1024 * 0.9) {
            score = Math.max(0, score - 5);
        }
        this.metrics.healthScore = score;
    }
}
/**
 * 🧠 MEMORY LIMITER - Control de uso de memoria
 * 🔧 FIX #8: Warning threshold ajustado para evitar alertas prematuras
 */
class MemoryLimiter {
    maxMemoryMB;
    warningThresholdMB;
    monitoringInterval;
    constructor(maxMemoryMB) {
        this.maxMemoryMB = maxMemoryMB;
        // 🔧 FIX #8: Warning threshold cambiado de 80% → 85% para dar más margen
        this.warningThresholdMB = maxMemoryMB * 0.85; // ⭐ Era 0.8, ahora 0.85
    }
    checkMemory() {
        const usage = process.memoryUsage().heapUsed / 1024 / 1024;
        if (usage >= this.maxMemoryMB) {
            return { status: 'critical', usage };
        }
        else if (usage >= this.warningThresholdMB) {
            return { status: 'warning', usage };
        }
        else {
            return { status: 'ok', usage };
        }
    }
    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}
/**
 * ⏱️ TIMEOUT WRAPPER - Control de timeouts con correlation IDs
 * 🔧 FIX #3: Zombie timeout prevention + cleanup periódico
 */
class TimeoutWrapper {
    activeTimeouts = new Map();
    cleanupInterval;
    MAX_TIMEOUT_AGE_MS = 60000; // ⭐ 1 minuto máximo para timeouts zombi
    constructor(logger) {
        // ⭐ Cleanup periódico de timeouts zombi
        this.cleanupInterval = setInterval(() => {
            this.cleanupZombieTimeouts();
        }, 30000); // Cada 30 segundos
    }
    async execute(operation, timeoutMs, operationName, correlationId) {
        return new Promise((resolve, reject) => {
            // Create timeout
            const timeout = setTimeout(() => {
                this.cleanupTimeout(correlationId); // ⭐ Usar helper
                const error = new Error(`TIMEOUT: Operation ${operationName} exceeded ${timeoutMs}ms`);
                console.error(`⏱️ ${error.message} [${correlationId}]`);
                reject(error);
            }, timeoutMs);
            // ⭐ Track timeout con timestamp
            this.activeTimeouts.set(correlationId, {
                timeout,
                timestamp: Date.now()
            });
            // Execute operation
            operation()
                .then((result) => {
                this.cleanupTimeout(correlationId);
                resolve(result);
            })
                .catch((error) => {
                this.cleanupTimeout(correlationId);
                console.error(`💥 Operation ${operationName} failed [${correlationId}]:`, error);
                reject(error);
            });
        });
    }
    // ⭐ Cleanup helper para evitar duplicación
    cleanupTimeout(correlationId) {
        const entry = this.activeTimeouts.get(correlationId);
        if (entry) {
            clearTimeout(entry.timeout);
            this.activeTimeouts.delete(correlationId);
        }
    }
    // ⭐ Cleanup de timeouts zombi (nunca resueltos/rechazados)
    cleanupZombieTimeouts() {
        const now = Date.now();
        let zombieCount = 0;
        for (const [id, entry] of this.activeTimeouts.entries()) {
            if (now - entry.timestamp > this.MAX_TIMEOUT_AGE_MS) {
                clearTimeout(entry.timeout);
                this.activeTimeouts.delete(id);
                zombieCount++;
            }
        }
        if (zombieCount > 0) {
            console.warn(`🧹 Cleaned up ${zombieCount} zombie timeouts`);
        }
    }
    cleanup() {
        // ⭐ Limpiar interval de cleanup
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        // Limpiar todos los timeouts activos
        for (const entry of this.activeTimeouts.values()) {
            clearTimeout(entry.timeout);
        }
        this.activeTimeouts.clear();
    }
}
/**
 * ❤️ HEALTH MONITOR - Monitoreo continuo de salud
 * 🔧 FIX #1: Lifecycle management mejorado para prevenir memory leaks
 */
class HealthMonitor {
    engineId;
    monitoringInterval;
    lastHealthCheck;
    isActive = false; // ⭐ Flag para prevenir duplicación
    constructor(engineId, logger) {
        this.engineId = engineId;
        this.lastHealthCheck = new Date();
    }
    async initialize() {
        // ⭐ Prevenir duplicación de intervals
        if (this.isActive) {
            console.warn(`⚠️ Health monitoring already active for ${this.engineId} - skipping initialization`);
            return;
        }
        // Start periodic health monitoring
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            }
            catch (error) {
                console.error(`💥 Health monitoring failed for ${this.engineId}:`, error);
            }
        }, 30000); // Every 30 seconds
        this.isActive = true; // ⭐ Marcar como activo
        // 🔥 REVERT: this.logger is console placeholder, not any - can't use logOnce()
        console.log(`❤️ Health monitoring started for ${this.engineId}`);
    }
    async performHealthCheck() {
        const now = new Date();
        const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
        // Only log if it's been more than 5 minutes since last detailed check
        if (timeSinceLastCheck > 300000) {
            const memUsage = process.memoryUsage();
            console.log(`💚 Health check ${this.engineId}: Memory ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            this.lastHealthCheck = now;
        }
    }
    async cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined; // ⭐ Nullificar referencia explícitamente
            console.log(`🧹 Health monitoring stopped for ${this.engineId}`);
        }
        this.isActive = false; // ⭐ Reset flag
    }
}
//# sourceMappingURL=BaseMetaEngine.js.map