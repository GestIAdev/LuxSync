interface ScheduledTask {
    id: string;
    name: string;
    cronExpression: string;
    handler: () => Promise<void>;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
    maxRetries: number;
    retryCount: number;
}
/**
 * ⏰ SELENE SCHEDULER - THE TIME GOD
 * Automated task scheduling with cron jobs
 */
export declare class SeleneScheduler {
    private tasks;
    private cronJobs;
    private isRunning;
    constructor();
    /**
     * 🚀 Start scheduler
     */
    start(): Promise<void>;
    /**
     * 🛑 Stop scheduler
     */
    stop(): Promise<void>;
    /**
     * ➕ Add scheduled task
     */
    addTask(task: Omit<ScheduledTask, "lastRun" | "nextRun" | "runCount" | "retryCount">): string;
    /**
     * 🗑️ Remove task
     */
    removeTask(taskId: string): boolean;
    /**
     * ▶️ Start specific task
     */
    startTask(taskId: string): Promise<void>;
    /**
     * ⏸️ Stop specific task
     */
    stopTask(taskId: string): void;
    /**
     * 🔄 Enable/disable task
     */
    setTaskEnabled(taskId: string, enabled: boolean): void;
    /**
     * 🚀 Execute task with error handling
     */
    private executeTask;
    /**
     * ⚡ Execute task immediately
     */
    executeTaskNow(taskId: string): Promise<void>;
    /**
     * 📊 Get scheduler status
     */
    getStatus(): any;
    /**
     * 📋 Get all tasks
     */
    getTasks(): ScheduledTask[];
    /**
     * 📋 Get task by ID
     */
    getTask(_taskId: string): ScheduledTask | undefined;
    /**
     * 📋 Initialize default scheduled tasks
     */
    private initializeDefaultTasks;
    /**
     * 💾 Database backup handler
     */
    private databaseBackupHandler;
    /**
     * 🧹 Cache cleanup handler
     */
    private cacheCleanupHandler;
    /**
     * ❤️ Health check handler
     */
    private healthCheckHandler;
    /**
     * 🤖 AI model update handler
     */
    private aiModelUpdateHandler;
    /**
     * 📊 Report generation handler
     */
    private reportGenerationHandler;
}
export {};
//# sourceMappingURL=Scheduler.d.ts.map