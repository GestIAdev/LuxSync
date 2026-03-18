/**
 * 🎼 MONITORING ORCHESTRATOR - SUPREME CONDUCTOR
 * By PunkClaude & RaulVisionario - September 25, 2025
 *
 * MISSION: Centralize and orchestrate all monitoring processes
 * ELIMINATE: Chaotic setInterval constellations
 * ACHIEVE: Intelligent, resilient monitoring architecture
 */
import * as schedule from "node-schedule";
import * as os from "os";
export class MonitoringOrchestrator {
    static instance;
    tasks = new Map();
    scheduledJobs = new Map();
    isShuttingDown = false;
    constructor() {
        this.setupEmergencyShutdown();
    }
    static getInstance() {
        if (!MonitoringOrchestrator.instance) {
            MonitoringOrchestrator.instance = new MonitoringOrchestrator();
        }
        return MonitoringOrchestrator.instance;
    }
    /**
     * Register a monitoring task with the orchestrator
     */
    registerTask(task) {
        if (this.tasks.has(task.id)) {
            console.warn(`⚠️ Task ${task.id} already registered, updating...`);
        }
        // Initialize circuit breaker if not provided
        if (!task.circuitBreaker) {
            task.circuitBreaker = {
                failureCount: 0,
                lastFailure: null,
                isOpen: false,
                threshold: 3,
                timeout: 5, // 5 minutes
            };
        }
        // Initialize lazy mode if not provided
        if (!task.lazyMode) {
            task.lazyMode = {
                enabled: true,
                cpuThreshold: 70, // Skip if CPU > 70%
            };
        }
        this.tasks.set(task.id, task);
        this.scheduleTask(task);
        console.log(`✅ Registered monitoring task: ${task.name} (${task.id})`);
    }
    /**
     * Schedule a task with node-schedule
     */
    scheduleTask(task) {
        const job = schedule.scheduleJob(task.cronExpression, async () => {
            if (this.isShuttingDown)
                return;
            await this.executeTask(task);
        });
        this.scheduledJobs.set(task.id, job);
    }
    /**
     * Execute a monitoring task with circuit breaker and lazy mode
     */
    async executeTask(task) {
        try {
            // Check circuit breaker
            if (task.circuitBreaker.isOpen) {
                const now = new Date();
                const timeSinceFailure = task.circuitBreaker.lastFailure
                    ? now.getTime() - task.circuitBreaker.lastFailure.getTime()
                    : 0;
                if (timeSinceFailure < task.circuitBreaker.timeout * 60 * 1000) {
                    console.log(`🔌 Circuit breaker OPEN for ${task.name}, skipping execution`);
                    return;
                }
                else {
                    // Reset circuit breaker
                    task.circuitBreaker.isOpen = false;
                    task.circuitBreaker.failureCount = 0;
                    console.log(`🔄 Circuit breaker RESET for ${task.name}`);
                }
            }
            // Check lazy mode
            if (task.lazyMode.enabled) {
                const cpuUsage = this.getCpuUsage();
                if (cpuUsage > task.lazyMode.cpuThreshold) {
                    task.lazyMode.skipReason = `CPU usage too high: ${cpuUsage.toFixed(2)}%`;
                    console.log(`😴 Lazy mode: Skipping ${task.name} (${task.lazyMode.skipReason})`);
                    return;
                }
            }
            // Execute task
            console.log(`🎼 Executing orchestrated task: ${task.name}`);
            await task.execute();
            console.log(`✅ Task completed: ${task.name}`);
            // Reset circuit breaker on success
            if (task.circuitBreaker.failureCount > 0) {
                task.circuitBreaker.failureCount = Math.max(0, task.circuitBreaker.failureCount - 1);
            }
        }
        catch (error) {
            console.error(`❌ Task failed: ${task.name}`, error);
            // Update circuit breaker
            task.circuitBreaker.failureCount++;
            task.circuitBreaker.lastFailure = new Date();
            if (task.circuitBreaker.failureCount >= task.circuitBreaker.threshold) {
                task.circuitBreaker.isOpen = true;
                console.error(`🔌 Circuit breaker TRIPPED for ${task.name} (${task.circuitBreaker.failureCount} failures)`);
            }
        }
    }
    /**
     * Get current CPU usage percentage
     */
    getCpuUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        return 100 - ~~((100 * totalIdle) / totalTick);
    }
    /**
     * Get all registered tasks
     */
    getRegisteredTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Get task by ID
     */
    getTask(_id) {
        return this.tasks.get(_id);
    }
    /**
     * Unregister a task
     */
    unregisterTask(id) {
        const task = this.tasks.get(id);
        if (task) {
            const job = this.scheduledJobs.get(id);
            if (job) {
                job.cancel();
                this.scheduledJobs.delete(id);
            }
            this.tasks.delete(id);
            console.log(`🗑️ Unregistered task: ${task.name}`);
        }
    }
    /**
     * Emergency shutdown - cancel all scheduled jobs
     */
    setupEmergencyShutdown() {
        process.on("SIGINT", () => {
            console.log("🚨 Emergency shutdown initiated...");
            this.shutdown();
        });
        process.on("SIGTERM", () => {
            console.log("🚨 Emergency shutdown initiated...");
            this.shutdown();
        });
    }
    /**
     * Graceful shutdown of all monitoring tasks
     */
    shutdown() {
        console.log("🔄 Shutting down Monitoring Orchestrator...");
        this.isShuttingDown = true;
        // Cancel all scheduled jobs
        for (const [id, job] of this.scheduledJobs) {
            job.cancel();
            console.log(`🛑 Cancelled job: ${id}`);
        }
        this.scheduledJobs.clear();
        this.tasks.clear();
        console.log("✅ Monitoring Orchestrator shutdown complete");
    }
    /**
     * Force immediate execution of a task (for testing)
     */
    async executeTaskNow(id) {
        const task = this.tasks.get(id);
        if (task) {
            await this.executeTask(task);
        }
        else {
            throw new Error(`Task ${id} not found`);
        }
    }
}
//# sourceMappingURL=MonitoringOrchestrator.js.map