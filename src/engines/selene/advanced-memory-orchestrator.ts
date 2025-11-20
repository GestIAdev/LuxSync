// 🧠 ADVANCED MEMORY ORCHESTRATOR - Memory management for Selene
// Coordina memoria entre consciousness, swarm y engines

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

export class AdvancedMemoryOrchestrator {
  private snapshots: MemorySnapshot[] = [];
  private limits: MemoryLimits = {
    maxHeap: 512 * 1024 * 1024, // 512MB
    maxRss: 1024 * 1024 * 1024, // 1GB
    warningThreshold: 0.8,
  };

  /**
   * Get current memory usage
   */
  getCurrentMemory(): MemorySnapshot {
    const mem = process.memoryUsage();
    const snapshot: MemorySnapshot = {
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
  isHealthy(): boolean {
    const current = this.getCurrentMemory();
    return (
      current.heap < this.limits.maxHeap * this.limits.warningThreshold &&
      current.rss < this.limits.maxRss * this.limits.warningThreshold
    );
  }

  /**
   * Get memory status
   */
  getStatus(): {
    healthy: boolean;
    heapUsedPercent: number;
    rssUsedPercent: number;
  } {
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
  setLimits(limits: Partial<MemoryLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Clear old snapshots
   */
  clearOldSnapshots(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;
    this.snapshots = this.snapshots.filter((s) => s.timestamp > cutoff);
  }
}

// Export singleton
export const getMemoryOrchestrator = (): AdvancedMemoryOrchestrator => {
  if (!(global as any).__memoryOrchestrator) {
    (global as any).__memoryOrchestrator = new AdvancedMemoryOrchestrator();
  }
  return (global as any).__memoryOrchestrator;
};
