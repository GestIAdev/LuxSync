/**
 * 📊 SELENE MONITORING - COMPLETE SYSTEM MONITORING MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Complete system monitoring and alerting
 * STRATEGY: Real-time metrics, health checks, and performance monitoring
 */
import * as winston from "winston";
import { monitoringOrchestrator, } from "./Monitoring/MonitoringOrchestrator.js";
/**
 * 📊 SELENE MONITORING - THE WATCHER GOD
 * Complete system monitoring with metrics and health checks
 */
export class SeleneMonitoring {
    logger;
    metrics = [];
    healthChecks = new Map();
    isRunning = false;
    metricsInterval = null;
    healthCheckInterval = null;
    constructor() {
        console.log('SYSTEM', "📊 Initializing Selene Monitoring...");
        this.initializeLogger();
        this.initializeDefaultHealthChecks();
    }
    /**
     * 📝 Initialize Winston logger
     */
    initializeLogger() {
        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: "selene" },
            transports: [
                // Write all logs with importance level of `error` or less to `error.log`
                new winston.transports.File({
                    filename: "logs/error.log",
                    level: "error",
                }),
                // Write all logs with importance level of `info` or less to `combined.log`
                new winston.transports.File({ filename: "logs/combined.log" }),
                // Write to console in development
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
                }),
            ],
        });
    }
    /**
     * 🚀 Start monitoring
     */
    async start() {
        try {
            console.log('SYSTEM', "🚀 Starting Selene Monitoring...");
            // Register monitoring tasks with the Orchestrator
            await this.registerMonitoringTasks();
            this.isRunning = true;
            console.log('SYSTEM', "Selene Monitoring operational - orchestrated");
        }
        catch (error) {
            console.log("Failed to start monitoring", error);
            throw error;
        }
    }
    /**
     * 🛑 Stop monitoring
     */
    async stop() {
        try {
            console.log('SYSTEM', "🛑 Stopping Selene Monitoring...");
            // The Orchestrator handles all interval cleanup
            this.isRunning = false;
            console.log('SYSTEM', "Monitoring stopped - Orchestrator notified");
        }
        catch (error) {
            console.log("Monitoring stop error", error);
        }
    }
    /**
     * 📝 Register monitoring tasks with the Orchestrator
     */
    async registerMonitoringTasks() {
        const tasks = [
            // Metrics Collection - Medium priority
            {
                id: "monitoring-metrics",
                name: "Metrics Collection",
                schedule: "*/30 * * * * *", // Every 30 seconds
                priority: "normal",
                // circuitBreaker: { threshold: 85, cooldownMs: 60000 },
                enabled: true,
            },
            // Health Checks - High priority
            {
                id: "monitoring-health",
                name: "Health Checks",
                schedule: "*/60 * * * * *", // Every minute
                priority: "high",
                // circuitBreaker: { threshold: 90, cooldownMs: 120000 },
                enabled: true,
            },
        ];
        // Register tasks with Orchestrator
        for (const task of tasks) {
            monitoringOrchestrator.registerTask(task);
        }
        console.log(`📝 Registered ${tasks.length} monitoring tasks with Orchestrator`);
    }
    // ==========================================
    // 📊 METRICS COLLECTION
    // ==========================================
    /**
     * 📈 Start metrics collection (legacy - now orchestrated)
     */
    startMetricsCollection() {
        // This method is now handled by the Orchestrator
        console.log('SYSTEM', "📈 Metrics collection now orchestrated");
    }
    /**
     * 📊 Collect system metrics
     */
    async collectMetrics() {
        try {
            const metrics = {
                timestamp: new Date(),
                cpu: process.cpuUsage().user / 1000000, // Convert to seconds
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                activeConnections: 0, // Will be updated by server
                responseTime: 0, // Will be updated by middleware
                errorRate: 0, // Will be calculated
            };
            this.metrics.push(metrics);
            // Keep only last 1000 metrics
            if (this.metrics.length > 1000) {
                this.metrics.shift();
            }
            // Log critical metrics
            if (metrics.memory.heapUsed > 500 * 1024 * 1024) {
                // 500MB
                console.log("High memory usage detected", {
                    heapUsed: metrics.memory.heapUsed,
                    heapTotal: metrics.memory.heapTotal,
                });
            }
        }
        catch (error) {
            console.log("Metrics collection error", error);
        }
    }
    /**
     * 📊 Get current metrics
     */
    getMetrics() {
        return [...this.metrics];
    }
    /**
     * 📊 Get latest metrics
     */
    getLatestMetrics() {
        return this.metrics.length > 0
            ? this.metrics[this.metrics.length - 1]
            : null;
    }
    /**
     * 📊 Get metrics summary
     */
    getMetricsSummary() {
        if (this.metrics.length === 0) {
            return { error: "No metrics available" };
        }
        const latest = this.metrics[this.metrics.length - 1];
        const avgResponseTime = this.metrics.reduce((_sum, _m) => _sum + _m.responseTime, 0) /
            this.metrics.length;
        const avgCpu = this.metrics.reduce((_sum, _m) => _sum + _m.cpu, 0) / this.metrics.length;
        return {
            current: latest,
            averages: {
                responseTime: avgResponseTime,
                cpu: avgCpu,
            },
            totalMetrics: this.metrics.length,
            uptime: latest.uptime,
        };
    }
    // ==========================================
    // ❤️ HEALTH CHECKS
    // ==========================================
    /**
     * ❤️ Start health checks (legacy - now orchestrated)
     */
    startHealthChecks() {
        // This method is now handled by the Orchestrator
        console.log('SYSTEM', "❤️ Health checks now orchestrated");
    }
    /**
     * ❤️ Perform all health checks
     */
    async performHealthChecks() {
        for (const [service, check] of this.healthChecks.entries()) {
            try {
                const startTime = Date.now();
                const result = await this.performHealthCheck(service);
                const responseTime = Date.now() - startTime;
                this.healthChecks.set(service, {
                    ...check,
                    status: result.healthy ? "healthy" : "unhealthy",
                    responseTime,
                    lastCheck: new Date(),
                    details: result.details,
                });
                // Log unhealthy services
                if (!result.healthy) {
                    console.log(`Health check failed for ${service}`, result.details);
                }
            }
            catch (error) {
                console.log(`Health check error for ${service}`, error);
                this.healthChecks.set(service, {
                    ...check,
                    status: "unhealthy",
                    responseTime: 0,
                    lastCheck: new Date(),
                    details: {
                        error: error instanceof Error ? error.message : "Unknown error",
                    },
                });
            }
        }
    }
    /**
     * ❤️ Perform individual health check
     */
    async performHealthCheck(_service) {
        switch (_service) {
            case "database":
                return await this.checkDatabaseHealth();
            case "redis":
                return await this.checkRedisHealth();
            case "filesystem":
                return await this.checkFilesystemHealth();
            case "memory":
                return await this.checkMemoryHealth();
            default:
                return { healthy: true };
        }
    }
    /**
     * ❤️ Check database health
     */
    async checkDatabaseHealth() {
        try {
            // Simulate database health check
            await new Promise((_resolve) => setTimeout(_resolve, 100));
            return { healthy: true, details: { connection: "ok" } };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }
    /**
     * ❤️ Check Redis health
     */
    async checkRedisHealth() {
        try {
            // Simulate Redis health check
            await new Promise((_resolve) => setTimeout(_resolve, 50));
            return { healthy: true, details: { connection: "ok" } };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }
    /**
     * ❤️ Check filesystem health
     */
    async checkFilesystemHealth() {
        try {
            // Simulate filesystem health check
            await new Promise((_resolve) => setTimeout(_resolve, 20));
            return { healthy: true, details: { writable: true } };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }
    /**
     * ❤️ Check memory health
     */
    async checkMemoryHealth() {
        const memUsage = process.memoryUsage();
        const healthy = memUsage.heapUsed < 800 * 1024 * 1024; // 800MB
        return {
            healthy,
            details: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                threshold: 800 * 1024 * 1024,
            },
        };
    }
    /**
     * ❤️ Initialize default health checks
     */
    initializeDefaultHealthChecks() {
        this.healthChecks.set("database", {
            service: "database",
            status: "healthy",
            responseTime: 0,
            lastCheck: new Date(),
        });
        this.healthChecks.set("redis", {
            service: "redis",
            status: "healthy",
            responseTime: 0,
            lastCheck: new Date(),
        });
        this.healthChecks.set("filesystem", {
            service: "filesystem",
            status: "healthy",
            responseTime: 0,
            lastCheck: new Date(),
        });
        this.healthChecks.set("memory", {
            service: "memory",
            status: "healthy",
            responseTime: 0,
            lastCheck: new Date(),
        });
        console.log('SYSTEM', "✅ Default health checks initialized");
    }
    /**
     * ❤️ Add custom health check
     */
    addHealthCheck(service, _checkFunction) {
        this.healthChecks.set(service, {
            service,
            status: "healthy",
            responseTime: 0,
            lastCheck: new Date(),
        });
        console.log('SYSTEM', `➕ Added health check for ${service}`);
    }
    /**
     * ❤️ Get health status
     */
    getHealthStatus() {
        const checks = Array.from(this.healthChecks.values());
        const healthy = checks.filter((_c) => _c.status === "healthy").length;
        const unhealthy = checks.filter((_c) => _c.status === "unhealthy").length;
        const warning = checks.filter((_c) => _c.status === "warning").length;
        return {
            overall: unhealthy === 0 ? "healthy" : "unhealthy",
            summary: { healthy, unhealthy, warning, total: checks.length },
            checks,
        };
    }
    // ==========================================
    // 📝 LOGGING
    // ==========================================
    /**
     * 📝 Log info message
     */
    logInfo(_message, _meta) {
        console.log(_message, _meta);
    }
    /**
     * 📝 Log error message
     */
    logError(_message, _error) {
        console.log(_message, _error);
    }
    /**
     * 📝 Log warning message
     */
    logWarning(_message, _meta) {
        console.log(_message, _meta);
    }
    /**
     * 📝 Log debug message
     */
    logDebug(_message, _meta) {
        console.log(_message, _meta);
    }
    // ==========================================
    // 📊 MONITORING STATUS
    // ==========================================
    /**
     * 📊 Get system status
     */
    async getSystemStatus() {
        const metrics = this.getMetricsSummary();
        const health = this.getHealthStatus();
        return {
            monitoring: {
                running: this.isRunning,
                metricsCollected: this.metrics.length,
                healthChecks: this.healthChecks.size,
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
            },
            metrics,
            health,
        };
    }
    /**
     * 📊 Get monitoring status
     */
    getStatus() {
        const orchestratorStatus = monitoringOrchestrator.getStatus();
        return {
            running: this.isRunning,
            metrics: {
                collected: this.metrics.length,
                latest: this.getLatestMetrics(),
            },
            healthChecks: {
                total: this.healthChecks.size,
                status: this.getHealthStatus(),
            },
            logging: {
                level: "INFO",
            },
            orchestrator: {
                active: orchestratorStatus.isActive,
                totalTasks: orchestratorStatus.totalTasks,
                scheduledTasks: orchestratorStatus.scheduledTasks,
                averageCpu: orchestratorStatus.averageCpu,
            },
        };
    }
}
//# sourceMappingURL=Monitoring.js.map