import { Pool } from 'pg';
import { RedisClientType } from 'redis';

/**
 * 🎯 BASE DATABASE - Abstract Base Class for Specialized Databases
 * ✅ MODULARIZED: Shared functionality for all database operations
 * ✅ POSTGRESQL + REDIS: Compatible with existing Database.ts architecture
 * ✅ HELPERS: Common query methods, caching, real-time updates
 */
export abstract class BaseDatabase {
  protected pool: Pool;
  protected redis: RedisClientType | null = null;
  protected redisConnectionId: string | null = null;
  protected isRedisConnected: boolean = false;
  protected lastRedisCheck: number = 0;
  protected redisCheckInterval: number = 30000; // 30 seconds

  constructor(pool: Pool, redis?: RedisClientType, redisConnectionId?: string) {
    this.pool = pool;
    this.redis = redis || null;
    this.redisConnectionId = redisConnectionId || null;
  }

  /**
   * 🔧 Execute raw query with parameters
   */
  protected async runQuery(sql: string, params: any[] = []): Promise<any> {
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      console.error("💥 Query execution failed:", error as Error);
      throw error;
    }
  }

  /**
   * 📊 Get single row
   */
  protected async getOne(sql: string, params: any[] = []): Promise<any> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error("💥 Get one failed:", error as Error);
      throw error;
    }
  }

  /**
   * 📋 Get multiple rows
   */
  protected async getAll(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error("💥 Get all failed:", error as Error);
      throw error;
    }
  }

  /**
   * 🔴 Get Redis client (with connection check)
   */
  protected getRedis(): RedisClientType {
    if (!this.redis) {
      throw new Error("Redis client not initialized");
    }
    return this.redis;
  }

  /**
   * 🛡️ Safe Redis operation with error handling
   */
  protected async safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      if (!this.redis) return fallback;
      return await operation();
    } catch (error) {
      console.warn(
        "⚠️ Redis operation failed:",
        error instanceof Error ? error.message : String(error)
      );
      return fallback;
    }
  }

  /**
   * 📡 Emit real-time updates via Redis pub/sub
   */
  protected async emitRealtimeUpdate(
    room: string,
    event: string,
    data: any,
  ): Promise<void> {
    try {
      if (!this.redis) return;

      await this.safeRedisOperation(
        () => this.redis!.publish(
          `realtime:${room}`,
          JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
          }),
        ),
        undefined
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to emit realtime update:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}