export interface SystemMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
        cores: number;
    };
    memory: {
        used: number;
        total: number;
        usage: number;
        free: number;
    };
    process: {
        uptime: number;
        pid: number;
        memoryUsage: NodeJS.MemoryUsage;
    };
    network: {
        connections: number;
        latency: number;
    };
    errors: {
        count: number;
        rate: number;
    };
    timestamp: number;
}
export interface VitalSigns {
    health: number;
    stress: number;
    harmony: number;
    creativity: number;
    timestamp: number;
}
export interface EngineActivity {
    engineName: string;
    operationType: string;
    startTime: number;
    endTime: number;
    cpuUsage?: number;
    memoryDelta?: number;
    success: boolean;
}
export interface EngineLoadMetrics {
    avgLatency: number;
    avgCpu: number;
    avgMemory: number;
    requestCount: number;
    errorRate: number;
}
export declare class SystemVitals {
    private static instance;
    private metrics;
    private vitalSigns;
    private errorCount;
    private lastErrorTime;
    private collectionInterval;
    private engineActivities;
    private readonly MAX_ACTIVITIES_PER_ENGINE;
    private constructor();
    static getInstance(): SystemVitals;
    collectMetrics(): SystemMetrics;
    calculateVitalSigns(): VitalSigns;
    getCurrentMetrics(): SystemMetrics;
    getCurrentVitalSigns(): VitalSigns;
    recordError(): void;
    resetErrorCount(): void;
    private calculateLatency;
    private startCollection;
    stopCollection(): void;
}
//# sourceMappingURL=SystemVitals.d.ts.map