export interface PM2NodeInfo {
    pm_id: number;
    name: string;
    pid: number;
    status: string;
    cpu: number;
    memory: number;
    uptime: number;
    restarts: number;
}
export interface PM2ClusterStatus {
    totalNodes: number;
    runningNodes: number;
    stoppedNodes: number;
    nodes: PM2NodeInfo[];
    loadBalancer: PM2NodeInfo | null;
    consensusAchieved: boolean;
    byzantineTolerance: number;
}
/**
 * 🎯 PM2 CLUSTER MANAGER
 *
 * Responsibilities:
 * - Start/stop PM2 cluster (3 Selene nodes + 1 load balancer)
 * - Health monitoring of all nodes
 * - Dynamic kill/restart for Byzantine fault testing
 * - Consensus validation across nodes
 * - Memory/CPU tracking per node
 * - Emergency shutdown procedures
 */
export declare class PM2ClusterManager {
    private pm2Connected;
    constructor();
    /**
     * Connect to PM2 daemon
     */
    connect(): Promise<void>;
    /**
     * Disconnect from PM2 daemon
     */
    disconnect(): Promise<void>;
    /**
     * Start entire cluster (3 nodes + load balancer)
     */
    startCluster(ecosystemPath: string): Promise<void>;
    /**
     * Stop entire cluster
     */
    stopCluster(): Promise<void>;
    /**
     * List all PM2 processes
     */
    listProcesses(): Promise<PM2NodeInfo[]>;
    /**
     * Get cluster status (nodes + load balancer + consensus)
     */
    getClusterStatus(): Promise<PM2ClusterStatus>;
    /**
     * Stop a specific process by name
     */
    stopProcess(name: string): Promise<void>;
    /**
     * Restart a specific process by name
     */
    restartProcess(name: string): Promise<void>;
    /**
     * Kill a specific process by name (for Byzantine testing)
     */
    killProcess(name: string): Promise<void>;
    /**
     * Get memory usage for all Selene nodes
     */
    getMemoryUsage(): Promise<{
        [nodeName: string]: number;
    }>;
    /**
     * Check if <300MB bet is won
     */
    checkMemoryBet(maxMB?: number): Promise<{
        won: boolean;
        peakNode: string;
        peakMB: number;
    }>;
    /**
     * Emergency shutdown: kill all Selene processes immediately
     */
    emergencyShutdown(): Promise<void>;
    /**
     * Watch cluster health in real-time (returns interval ID)
     */
    watchClusterHealth(intervalSeconds?: number): NodeJS.Timeout;
    /**
     * Stop health watching
     */
    stopWatching(intervalId: NodeJS.Timeout): void;
}
//# sourceMappingURL=PM2ClusterManager.d.ts.map