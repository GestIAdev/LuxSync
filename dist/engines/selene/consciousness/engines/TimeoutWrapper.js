/**
 * ⏱️ TIMEOUT WRAPPER - Control de timeouts con tracking de operaciones
 * Fase 0: Wrapper reutilizable para operaciones con timeout
 *
 * Características: Correlation IDs, Cleanup automático, Métricas
 * Forged by PunkClaude + Claude 4.5
 */
import { deterministicId } from '../../shared/deterministic-utils.js';
/**
 * ⏱️ Timeout Wrapper con gestión avanzada de operaciones
 */
export class TimeoutWrapper {
    config;
    activeOperations = new Map();
    operationMetrics = new Map();
    cleanupInterval;
    constructor(configOrTimeout) {
        // Support both config object and simple timeout number
        if (typeof configOrTimeout === 'number') {
            this.config = {
                defaultTimeoutMs: configOrTimeout,
                maxConcurrentOperations: 10,
                cleanupIntervalMs: 300000,
                name: 'TimeoutWrapper'
            };
        }
        else {
            this.config = configOrTimeout || {
                defaultTimeoutMs: 30000,
                maxConcurrentOperations: 10,
                cleanupIntervalMs: 300000,
                name: 'TimeoutWrapper'
            };
        }
        // Start cleanup interval
        this.startCleanupInterval();
        console.log(`⏱️ Timeout Wrapper "${this.config.name}" initialized: default=${this.config.defaultTimeoutMs}ms, maxConcurrent=${this.config.maxConcurrentOperations}`);
    }
    /**
     * 🚀 Execute operation with timeout protection
     */
    async execute(operation, timeoutMs = this.config.defaultTimeoutMs, operationName = 'anonymous', correlationId = this.generateCorrelationId()) {
        // Check concurrent operations limit
        if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
            const error = new Error(`MAX_CONCURRENT_OPERATIONS_EXCEEDED: ${this.activeOperations.size}/${this.config.maxConcurrentOperations}`);
            console.error(`🚫 ${error.message} for ${operationName} [${correlationId}]`);
            return {
                success: false,
                error,
                executionTime: 0,
                timedOut: false,
                correlationId
            };
        }
        const startTime = Date.now();
        let timeoutHandle;
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                const error = new Error(`TIMEOUT: Operation ${operationName} exceeded ${timeoutMs}ms`);
                console.error(`⏱️ ${error.message} [${correlationId}]`);
                reject(error);
            }, timeoutMs);
        });
        // Track active operation
        const activeOp = {
            correlationId,
            operationName,
            startTime: new Date(),
            timeout: timeoutHandle,
            resolve: () => { },
            reject: () => { }
        };
        this.activeOperations.set(correlationId, activeOp);
        try {
            // Race between operation and timeout
            const result = await Promise.race([
                operation(),
                timeoutPromise
            ]);
            // Success
            const executionTime = Date.now() - startTime;
            this.recordSuccess(operationName, executionTime);
            console.log(`✅ Operation ${operationName} completed in ${executionTime}ms [${correlationId}]`);
            return {
                success: true,
                data: result,
                executionTime,
                timedOut: false,
                correlationId
            };
        }
        catch (error) {
            // Failure or timeout
            const executionTime = Date.now() - startTime;
            const timedOut = error.message.includes('TIMEOUT');
            if (timedOut) {
                this.recordTimeout(operationName, executionTime);
            }
            else {
                this.recordFailure(operationName, executionTime);
            }
            console.error(`💥 Operation ${operationName} failed (${timedOut ? 'timeout' : 'error'}) in ${executionTime}ms [${correlationId}]:`, error);
            return {
                success: false,
                error: error,
                executionTime,
                timedOut,
                correlationId
            };
        }
        finally {
            // Cleanup
            clearTimeout(timeoutHandle);
            this.activeOperations.delete(correlationId);
        }
    }
    /**
     * 🛑 Cancel operation by correlation ID
     */
    cancelOperation(correlationId) {
        const operation = this.activeOperations.get(correlationId);
        if (!operation) {
            return false;
        }
        clearTimeout(operation.timeout);
        this.activeOperations.delete(correlationId);
        const executionTime = Date.now() - operation.startTime.getTime();
        this.recordCancellation(operation.operationName, executionTime);
        console.log(`🛑 Operation ${operation.operationName} cancelled after ${executionTime}ms [${correlationId}]`);
        return true;
    }
    /**
     * 📊 Get active operations
     */
    getActiveOperations() {
        return Array.from(this.activeOperations.values()).map(op => ({
            correlationId: op.correlationId,
            operationName: op.operationName,
            startTime: op.startTime,
            elapsedMs: Date.now() - op.startTime.getTime()
        }));
    }
    /**
     * 📈 Get operation metrics
     */
    getMetrics(operationName) {
        if (operationName) {
            return this.operationMetrics.get(operationName) || this.createEmptyMetrics(operationName);
        }
        return new Map(this.operationMetrics);
    }
    /**
     * 🧹 Cleanup resources
     */
    cleanup() {
        // Cancel all active operations
        for (const [correlationId, operation] of this.activeOperations) {
            clearTimeout(operation.timeout);
            console.log(`🧹 Cancelled active operation ${operation.operationName} [${correlationId}] during cleanup`);
        }
        this.activeOperations.clear();
        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        console.log(`🧹 Timeout Wrapper "${this.config.name}" cleanup completed`);
    }
    // ===========================================
    // PRIVATE METHODS
    // ===========================================
    generateCorrelationId() {
        return deterministicId('timeout', Date.now());
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupIntervalMs);
    }
    performCleanup() {
        const now = Date.now();
        let cleaned = 0;
        // Remove stale metrics (older than 1 hour)
        for (const [operationName, metrics] of this.operationMetrics) {
            if (now - metrics.lastUpdated.getTime() > 3600000) { // 1 hour
                this.operationMetrics.delete(operationName);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} stale operation metrics`);
        }
    }
    recordSuccess(operationName, executionTime) {
        this.updateMetrics(operationName, metrics => {
            metrics.totalOperations++;
            metrics.successCount++;
            metrics.totalExecutionTime += executionTime;
            metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalOperations;
            if (executionTime > metrics.maxExecutionTime) {
                metrics.maxExecutionTime = executionTime;
            }
        });
    }
    recordFailure(operationName, executionTime) {
        this.updateMetrics(operationName, metrics => {
            metrics.totalOperations++;
            metrics.failureCount++;
            metrics.totalExecutionTime += executionTime;
        });
    }
    recordTimeout(operationName, executionTime) {
        this.updateMetrics(operationName, metrics => {
            metrics.totalOperations++;
            metrics.timeoutCount++;
            metrics.totalExecutionTime += executionTime;
        });
    }
    recordCancellation(operationName, executionTime) {
        this.updateMetrics(operationName, metrics => {
            metrics.totalOperations++;
            metrics.cancelledCount++;
            metrics.totalExecutionTime += executionTime;
        });
    }
    updateMetrics(operationName, updater) {
        const metrics = this.operationMetrics.get(operationName) || this.createEmptyMetrics(operationName);
        updater(metrics);
        metrics.lastUpdated = new Date();
        this.operationMetrics.set(operationName, metrics);
    }
    createEmptyMetrics(operationName) {
        return {
            operationName,
            totalOperations: 0,
            successCount: 0,
            failureCount: 0,
            timeoutCount: 0,
            cancelledCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            maxExecutionTime: 0,
            lastUpdated: new Date()
        };
    }
}
/**
 * 🏭 Timeout Wrapper Factory
 */
export class TimeoutWrapperFactory {
    static defaultConfig = {
        defaultTimeoutMs: 30000, // 30 seconds
        maxConcurrentOperations: 10,
        cleanupIntervalMs: 300000 // 5 minutes
    };
    /**
     * 🛠️ Create timeout wrapper with custom config
     */
    static create(config) {
        return new TimeoutWrapper(config);
    }
    /**
     * ⚡ Create timeout wrapper with defaults
     */
    static createDefault(name) {
        return new TimeoutWrapper({
            ...this.defaultConfig,
            name
        });
    }
    /**
     * 🔧 Create timeout wrapper for engine operations
     */
    static createForEngine(engineId) {
        const config = {
            defaultTimeoutMs: 10000, // 10 seconds for engines
            maxConcurrentOperations: 5,
            cleanupIntervalMs: 60000, // 1 minute
            name: `Engine-${engineId}`
        };
        return new TimeoutWrapper(config);
    }
    /**
     * 🌐 Create timeout wrapper for orchestration
     */
    static createForOrchestration(orchestratorId) {
        const config = {
            defaultTimeoutMs: 60000, // 1 minute for orchestration
            maxConcurrentOperations: 20,
            cleanupIntervalMs: 300000, // 5 minutes
            name: `Orchestrator-${orchestratorId}`
        };
        return new TimeoutWrapper(config);
    }
}
//# sourceMappingURL=TimeoutWrapper.js.map