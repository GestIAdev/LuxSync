// 🧠 ADVANCED MEMORY ORCHESTRATOR - Memory management for Selene
// Coordina memoria entre consciousness, swarm y engines
export class AdvancedMemoryOrchestrator {
    snapshots = [];
    limits = {
        maxHeap: 512 * 1024 * 1024, // 512MB
        maxRss: 1024 * 1024 * 1024, // 1GB
        warningThreshold: 0.8,
    };
    /**
     * Get current memory usage
     */
    getCurrentMemory() {
        const mem = process.memoryUsage();
        const snapshot = {
            timestamp: Date.now(),
            heap: mem.heapUsed,
            external: mem.external,
            rss: mem.rss,
        };
        this.snapshots.push(snapshot);
        if (this.snapshots.length > 1000) {
            this.snapshots.shift();
        }
        return snapshot;
    }
    /**
     * Check if memory is healthy
     */
    isHealthy() {
        const current = this.getCurrentMemory();
        return (current.heap < this.limits.maxHeap * this.limits.warningThreshold &&
            current.rss < this.limits.maxRss * this.limits.warningThreshold);
    }
    /**
     * Get memory status
     */
    getStatus() {
        const current = this.getCurrentMemory();
        return {
            healthy: this.isHealthy(),
            heapUsedPercent: current.heap / this.limits.maxHeap,
            rssUsedPercent: current.rss / this.limits.maxRss,
        };
    }
    /**
     * Set memory limits
     */
    setLimits(limits) {
        this.limits = { ...this.limits, ...limits };
    }
    /**
     * Clear old snapshots
     */
    clearOldSnapshots(maxAge = 3600000) {
        const cutoff = Date.now() - maxAge;
        this.snapshots = this.snapshots.filter((s) => s.timestamp > cutoff);
    }
}
// Export singleton
export const getMemoryOrchestrator = () => {
    if (!global.__memoryOrchestrator) {
        global.__memoryOrchestrator = new AdvancedMemoryOrchestrator();
    }
    return global.__memoryOrchestrator;
};
//# sourceMappingURL=advanced-memory-orchestrator.js.map