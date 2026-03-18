/**
 * 🔴 REDIS CONNECTION MANAGER - THE ANCHOR BREAKER
 * By PunkClaude - October 3, 2025
 *
 * MISSION: Break the cursed anchor causing memory leaks
 * STRATEGY: Connection pooling with context-based reuse and automatic cleanup
 */
declare const Redis: any;
/**
 * 🔴 REDIS CONNECTION MANAGER
 * The anchor breaker - prevents memory leaks from open Redis connections
 */
export declare class RedisConnectionManager {
    private static instance;
    private config;
    private connectionPools;
    private connectionCounter;
    private cleanupInterval;
    private readonly DEFAULT_MAX_CONNECTIONS_PER_CONTEXT;
    private readonly MAX_TOTAL_CONNECTIONS;
    private constructor();
    /**
     * 🚀 Get singleton instance
     */
    static getInstance(): RedisConnectionManager;
    /**
     * � Get or create connection pool for context
     */
    private getConnectionPool;
    /**
     * 🔌 Get total active connections across all pools
     */
    private getTotalActiveConnections;
    /**
     * 🔌 Add connection to pool
     */
    private addConnectionToPool;
    /**
     * 🔌 Remove connection from pool
     */
    private removeConnectionFromPool;
    /**
     * 🔌 Find connection info by ID or client reference
     */
    private findConnectionInfo;
    /**
     * 🔌 Get available connection from pool
     */
    private getAvailableConnection;
    /**
     * 🔌 Create mock subscriber client for error cases
     */
    private createMockSubscriberClient;
    /**
     * 🔌 Create mock client for error cases
     */
    private createMockClient;
    /**
     * 🔌 Create new Redis client (redis package) - with pool management
     */
    createRedisClient(context?: string): any;
    /**
     * 🔌 Create new IORedis client (ioredis package) - with pool management
     */
    createIORedisClient(context?: string): typeof Redis;
    /**
     * 🔌 Create new IORedis subscriber client (ioredis package) - with pool management
     */
    createIORedisSubscriberClient(context?: string): typeof Redis;
    /**
     * 🔌 Get existing client by context (reuse if possible) - pool-based
     */
    getRedisClient(context: string): any;
    /**
     * 🔌 Get existing IORedis client by context (reuse if possible) - pool-based
     */
    getIORedisClient(context: string): typeof Redis | null;
    /**
     * 🔌 Get existing IORedis subscriber client by context (reuse if possible) - pool-based
     */
    getIORedisSubscriberClient(context: string): typeof Redis | null;
    /**
     * 🔌 Ensure connection is active
     */
    /**
     * 🔥 SANITACIÓN-QUIRÚRGICA: Exponential Backoff Retry Logic
     * Ensures connection with silent retries for warm-up race conditions
     */
    ensureConnection(client: any, connectionId?: string, maxRetries?: number, initialDelay?: number): Promise<boolean>;
    /**
     * 🔌 INTERNAL: Single connection attempt (original logic)
     */
    private _attemptConnection;
    /**
     * 🔌 Close specific connection
     */
    closeConnection(connectionId: string): Promise<void>;
    /**
     * 🧹 Close all connections
     */
    closeAllConnections(): Promise<void>;
    /**
     * 📊 Get connection statistics
     */
    getConnectionStats(): any;
    /**
     * 🔄 Update connection status
     */
    private updateConnectionStatus;
    /**
     * 🧹 Start cleanup interval
     */
    private startCleanupInterval;
    /**
     * 🧹 Perform cleanup of old connections
     */
    private performCleanup;
    /**
     * � Initialize Redis Connection Manager (non-blocking)
     */
    initializeAsync(): Promise<boolean>;
}
export declare const redisManager: RedisConnectionManager;
export {};
//# sourceMappingURL=RedisConnectionManager.d.ts.map