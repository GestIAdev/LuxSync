/**
 * 🎼 MONITORING ORCHESTRATOR - SUPREME CONDUCTOR
 * By PunkClaude & RaulVisionario - September 25, 2025
 *
 * MISSION: Centralize and orchestrate all monitoring processes
 * ELIMINATE: Chaotic setInterval constellations
 * ACHIEVE: Intelligent, resilient monitoring architecture
 */
export interface MonitoringTask {
    id: string;
    name: string;
    cronExpression: string;
    execute: () => Promise<void>;
    circuitBreaker?: {
        failureCount: number;
        lastFailure: Date | null;
        isOpen: boolean;
        threshold: number;
        timeout: number;
    };
    lazyMode?: {
        enabled: boolean;
        cpuThreshold: number;
        skipReason?: string;
    };
    metadata?: {
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        tags: string[];
    };
}
export declare class MonitoringOrchestrator {
    private static instance;
    private tasks;
    private scheduledJobs;
    private isShuttingDown;
    private constructor();
    static getInstance(): MonitoringOrchestrator;
    /**
     * Register a monitoring task with the orchestrator
     */
    registerTask(task: MonitoringTask): void;
    /**
     * Schedule a task with node-schedule
     */
    private scheduleTask;
    /**
     * Execute a monitoring task with circuit breaker and lazy mode
     */
    private executeTask;
    /**
     * Get current CPU usage percentage
     */
    private getCpuUsage;
    /**
     * Get all registered tasks
     */
    getRegisteredTasks(): MonitoringTask[];
    /**
     * Get task by ID
     */
    getTask(_id: string): MonitoringTask | undefined;
    /**
     * Unregister a task
     */
    unregisterTask(id: string): void;
    /**
     * Emergency shutdown - cancel all scheduled jobs
     */
    private setupEmergencyShutdown;
    /**
     * Graceful shutdown of all monitoring tasks
     */
    shutdown(): void;
    /**
     * Force immediate execution of a task (for testing)
     */
    executeTaskNow(id: string): Promise<void>;
}
//# sourceMappingURL=MonitoringOrchestrator.d.ts.map