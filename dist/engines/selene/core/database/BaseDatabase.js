/**
 * 🎯 BASE DATABASE - Abstract Base Class for Specialized Databases
 * ✅ MODULARIZED: Shared functionality for all database operations
 * ✅ POSTGRESQL + REDIS: Compatible with existing Database.ts architecture
 * ✅ HELPERS: Common query methods, caching, real-time updates
 */
export class BaseDatabase {
    pool;
    redis = null;
    redisConnectionId = null;
    isRedisConnected = false;
    lastRedisCheck = 0;
    redisCheckInterval = 30000; // 30 seconds
    constructor(pool, redis, redisConnectionId) {
        this.pool = pool;
        this.redis = redis || null;
        this.redisConnectionId = redisConnectionId || null;
    }
    /**
     * 🔧 Execute raw query with parameters
     */
    async runQuery(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result;
        }
        catch (error) {
            console.error("💥 Query execution failed:", error);
            throw error;
        }
    }
    /**
     * 📊 Get single row
     */
    async getOne(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error("💥 Get one failed:", error);
            throw error;
        }
    }
    /**
     * 📋 Get multiple rows
     */
    async getAll(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows;
        }
        catch (error) {
            console.error("💥 Get all failed:", error);
            throw error;
        }
    }
    /**
     * 🔴 Get Redis client (with connection check)
     */
    getRedis() {
        if (!this.redis) {
            throw new Error("Redis client not initialized");
        }
        return this.redis;
    }
    /**
     * 🛡️ Safe Redis operation with error handling
     */
    async safeRedisOperation(operation, fallback) {
        try {
            if (!this.redis)
                return fallback;
            return await operation();
        }
        catch (error) {
            console.warn("⚠️ Redis operation failed:", error instanceof Error ? error.message : String(error));
            return fallback;
        }
    }
    /**
     * 📡 Emit real-time updates via Redis pub/sub
     */
    async emitRealtimeUpdate(room, event, data) {
        try {
            if (!this.redis)
                return;
            await this.safeRedisOperation(() => this.redis.publish(`realtime:${room}`, JSON.stringify({
                event,
                data,
                timestamp: new Date().toISOString(),
            })), undefined);
        }
        catch (error) {
            console.warn("⚠️ Failed to emit realtime update:", error instanceof Error ? error.message : String(error));
        }
    }
}
//# sourceMappingURL=BaseDatabase.js.map