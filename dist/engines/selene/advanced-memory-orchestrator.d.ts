export interface MemorySnapshot {
    timestamp: number;
    heap: number;
    external: number;
    rss: number;
}
export interface MemoryLimits {
    maxHeap: number;
    maxRss: number;
    warningThreshold: number;
}
export declare class AdvancedMemoryOrchestrator {
    private snapshots;
    private limits;
    /**
     * Get current memory usage
     */
    getCurrentMemory(): MemorySnapshot;
    /**
     * Check if memory is healthy
     */
    isHealthy(): boolean;
    /**
     * Get memory status
     */
    getStatus(): {
        healthy: boolean;
        heapUsedPercent: number;
        rssUsedPercent: number;
    };
    /**
     * Set memory limits
     */
    setLimits(limits: Partial<MemoryLimits>): void;
    /**
     * Clear old snapshots
     */
    clearOldSnapshots(maxAge?: number): void;
}
export declare const getMemoryOrchestrator: () => AdvancedMemoryOrchestrator;
//# sourceMappingURL=advanced-memory-orchestrator.d.ts.map