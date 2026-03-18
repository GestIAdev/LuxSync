/**
 * 📊 SELENE MONITORING - COMPLETE SYSTEM MONITORING MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Complete system monitoring and alerting
 * STRATEGY: Real-time metrics, health checks, and performance monitoring
 */
interface SystemMetrics {
    timestamp: Date;
    cpu: number;
    memory: NodeJS.MemoryUsage;
    uptime: number;
    activeConnections: number;
    responseTime: number;
    errorRate: number;
}
/**
 * 📊 SELENE MONITORING - THE WATCHER GOD
 * Complete system monitoring with metrics and health checks
 */
export declare class SeleneMonitoring {
    private logger;
    private metrics;
    private healthChecks;
    private isRunning;
    private metricsInterval;
    private healthCheckInterval;
    constructor();
    /**
     * 📝 Initialize Winston logger
     */
    private initializeLogger;
    /**
     * 🚀 Start monitoring
     */
    start(): Promise<void>;
    /**
     * 🛑 Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * 📝 Register monitoring tasks with the Orchestrator
     */
    private registerMonitoringTasks;
    /**
     * 📈 Start metrics collection (legacy - now orchestrated)
     */
    private startMetricsCollection;
    /**
     * 📊 Collect system metrics
     */
    private collectMetrics;
    /**
     * 📊 Get current metrics
     */
    getMetrics(): SystemMetrics[];
    /**
     * 📊 Get latest metrics
     */
    getLatestMetrics(): SystemMetrics | null;
    /**
     * 📊 Get metrics summary
     */
    getMetricsSummary(): any;
    /**
     * ❤️ Start health checks (legacy - now orchestrated)
     */
    private startHealthChecks;
    /**
     * ❤️ Perform all health checks
     */
    private performHealthChecks;
    /**
     * ❤️ Perform individual health check
     */
    private performHealthCheck;
    /**
     * ❤️ Check database health
     */
    private checkDatabaseHealth;
    /**
     * ❤️ Check Redis health
     */
    private checkRedisHealth;
    /**
     * ❤️ Check filesystem health
     */
    private checkFilesystemHealth;
    /**
     * ❤️ Check memory health
     */
    private checkMemoryHealth;
    /**
     * ❤️ Initialize default health checks
     */
    private initializeDefaultHealthChecks;
    /**
     * ❤️ Add custom health check
     */
    addHealthCheck(service: string, _checkFunction: () => Promise<{
        healthy: boolean;
        details?: any;
    }>): void;
    /**
     * ❤️ Get health status
     */
    getHealthStatus(): any;
    /**
     * 📝 Log info message
     */
    logInfo(_message: string, _meta?: any): void;
    /**
     * 📝 Log error message
     */
    logError(_message: string, _error?: any): void;
    /**
     * 📝 Log warning message
     */
    logWarning(_message: string, _meta?: any): void;
    /**
     * 📝 Log debug message
     */
    logDebug(_message: string, _meta?: any): void;
    /**
     * 📊 Get system status
     */
    getSystemStatus(): Promise<any>;
    /**
     * 📊 Get monitoring status
     */
    getStatus(): any;
}
export {};
//# sourceMappingURL=Monitoring.d.ts.map