import { Pool } from 'pg';
import { RedisClientType } from 'redis';
/**
 * 🎯 BASE DATABASE - Abstract Base Class for Specialized Databases
 * ✅ MODULARIZED: Shared functionality for all database operations
 * ✅ POSTGRESQL + REDIS: Compatible with existing Database.ts architecture
 * ✅ HELPERS: Common query methods, caching, real-time updates
 */
export declare abstract class BaseDatabase {
    protected pool: Pool;
    protected redis: RedisClientType | null;
    protected redisConnectionId: string | null;
    protected isRedisConnected: boolean;
    protected lastRedisCheck: number;
    protected redisCheckInterval: number;
    constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string);
    /**
     * 🔧 Execute raw query with parameters
     */
    protected runQuery(sql: string, params?: any[]): Promise<any>;
    /**
     * 📊 Get single row
     */
    protected getOne(sql: string, params?: any[]): Promise<any>;
    /**
     * 📋 Get multiple rows
     */
    protected getAll(sql: string, params?: any[]): Promise<any[]>;
    /**
     * 🔴 Get Redis client (with connection check)
     */
    protected getRedis(): RedisClientType;
    /**
     * 🛡️ Safe Redis operation with error handling
     */
    protected safeRedisOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T>;
    /**
     * 📡 Emit real-time updates via Redis pub/sub
     */
    protected emitRealtimeUpdate(room: string, event: string, data: any): Promise<void>;
}
//# sourceMappingURL=BaseDatabase.d.ts.map