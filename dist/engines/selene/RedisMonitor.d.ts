import type Redis from 'ioredis';
export interface RedisMetrics {
    commands: number;
    connections: number;
    latency: number;
    errors: number;
    timestamp: number;
}
export declare class RedisMonitor {
    private redis?;
    private metrics;
    constructor(redis?: Redis);
    /**
     * Get current Redis metrics
     */
    getMetrics(): RedisMetrics;
    /**
     * Record command execution
     */
    recordCommand(latency: number): void;
    /**
     * Record error
     */
    recordError(): void;
    /**
     * Reset metrics
     */
    reset(): void;
    /**
     * Start monitoring (placeholder)
     */
    start(): void;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Record connection
     */
    recordConnection(): void;
    /**
     * Record ping
     */
    recordPing(latency: number): void;
}
export declare const redisMonitor: RedisMonitor;
//# sourceMappingURL=RedisMonitor.d.ts.map