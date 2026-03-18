export interface MonitoringTask {
    id: string;
    name: string;
    interval?: number;
    schedule?: string;
    priority?: 'low' | 'normal' | 'high';
    enabled: boolean;
    lastRun?: number;
}
export interface MonitoringAlert {
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: number;
}
export declare class MonitoringOrchestrator {
    private tasks;
    private alerts;
    /**
     * Register monitoring task
     */
    registerTask(task: MonitoringTask): void;
    /**
     * Unregister task
     */
    unregisterTask(id: string): void;
    /**
     * Get tasks
     */
    getTasks(): MonitoringTask[];
    /**
     * Execute all enabled tasks
     */
    executeTasks(): Promise<void>;
    /**
     * Get orchestrator status
     */
    getStatus(): {
        taskCount: number;
        alertCount: number;
        enabled: boolean;
        isActive?: boolean;
        totalTasks?: number;
        scheduledTasks?: number;
        averageCpu?: number;
    };
    /**
     * Add alert
     */
    addAlert(alert: MonitoringAlert): void;
    /**
     * Get recent alerts
     */
    getAlerts(limit?: number): MonitoringAlert[];
    /**
     * Clear alerts
     */
    clearAlerts(): void;
}
export declare const monitoringOrchestrator: MonitoringOrchestrator;
//# sourceMappingURL=MonitoringOrchestrator.d.ts.map