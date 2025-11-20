/**
 * ⚡ SELENE CACHE - DISTRIBUTED INTELLIGENCE MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Intelligent distributed caching system
 * STRATEGY: Redis-powered cache with predictive loading
 */

import { RedisClientType } from "redis";
import { redisManager } from "./RedisConnectionManager.js";


interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number;
}

interface CacheEntry {
  key: string;
  value: any;
  ttl?: number;
  tags?: string[];
}

/**
 * ⚡ SELENE CACHE - THE MEMORY GOD
 * Intelligent distributed caching with predictive loading
 */
export class SeleneCache {
  private client!: RedisClientType;
  private config: CacheConfig;
  private isConnected: boolean = false;
  private connectionId: string;
  private predictiveCache: Map<string, any> = new Map();
  private accessPatterns: Map<string, number[]> = new Map();
  private maxPredictiveCacheSize: number = 1000;
  private maxAccessPatternsSize: number = 5000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log("⚡ Initializing Selene Cache...");

    this.config = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || "0"),
      ttl: parseInt(process.env.CACHE_TTL || "3600"), // 1 hour default
    };

    // Get Redis client from manager
    this.client = redisManager.createRedisClient("apollo-cache");
    this.connectionId = `apollo-cache_${Date.now()}`;

    // Handle connection events
    this.client.on("connect", () => {
      console.log("✅ Selene Cache Redis connected");
      this.isConnected = true;
    });

    this.client.on("error", (_error) => {
      // Don't log connection errors - Redis not being available is expected
      this.isConnected = false;
    });

    this.client.on("disconnect", () => {
      console.log("🔌 Selene Cache Redis disconnected");
      this.isConnected = false;
    });

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * � Ensure Redis connection is active
   */
  private async ensureConnection(): Promise<void> {
    try {
      if (!this.isConnected || !this.client.isReady) {
        console.log("🔌 Attempting Redis reconnection...");
        await redisManager.ensureConnection(this.client, this.connectionId);
        this.isConnected = true;
        console.log("✅ Redis reconnected successfully");
      }
    } catch (error) {
      console.log("⚠️ Redis reconnection failed, continuing in offline mode");
      this.isConnected = false;
    }
  }

  /**
   * � Connect to Redis
   */
  public async connect(): Promise<void> {
    try {
      console.log("🔌 Connecting to Selene Cache...");
      await redisManager.ensureConnection(this.client, this.connectionId);
      console.log("🎯 Selene Cache operational");
    } catch (error) {
      console.error("💥 Failed to connect to Selene Cache:", error as Error);
      throw error;
    }
  }

  /**
   * 🔌 Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      this.stopCleanupInterval();
      await redisManager.closeConnection(this.connectionId);
      this.isConnected = false;
      console.log("✅ Selene Cache disconnected");
    } catch (error) {
      console.error("💥 Selene Cache disconnection error:", error as Error);
    }
  }

  // ==========================================
  // 📥 BASIC CACHE OPERATIONS
  // ==========================================

  /**
   * 💾 Set cache entry
   */
  public async set(
    key: string,
    value: any,
    _ttl?: number,
    tags?: string[],
  ): Promise<void> {
    // If not connected, skip operation silently
    if (!this.isConnected) {
      return;
    }

    try {
      const serializedValue = JSON.stringify(value);
      const actualTtl = _ttl || this.config.ttl;

      await this.client.setEx(key, actualTtl, serializedValue);

      // Store tags for batch invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await this.client.sAdd(`tag:${tag}`, key);
        }
      }

      // Track access pattern
      this.trackAccessPattern(key);

      // Predictive caching
      this.predictiveLoad(key, value);
    } catch (error) {
      // Don't log errors when Redis is not connected
      if (this.isConnected) {
        console.error("💥 Cache set error:", error as Error);
      }
    }
  }

  /**
   * 📖 Get cache entry
   */
  public async get<T = any>(key: string): Promise<T | null> {
    // If not connected, return null without attempting operation
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);

      if (!value) {
        return null;
      }

      // Track access pattern
      this.trackAccessPattern(key);

      return JSON.parse(value) as T;
    } catch (error) {
      // Don't log errors when Redis is not connected - this is expected
      if (this.isConnected) {
        console.error("💥 Cache get error:", error as Error);
      }
      return null;
    }
  }

  /**
   * 🗑️ Delete cache entry
   */
  public async delete(key: string): Promise<boolean> {
    // If not connected, return false
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.del(key);

      // Remove from tags
      const tagKeys = await this.client.keys("tag:*");
      for (const tagKey of tagKeys) {
        await this.client.sRem(tagKey, key);
      }

      return result > 0;
    } catch (error) {
      // Don't log errors when Redis is not connected
      if (this.isConnected) {
        console.error("💥 Cache delete error:", error as Error);
      }
      return false;
    }
  }

  /**
   * 🔍 Check if key exists
   */
  public async exists(_key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(_key);
      return result > 0;
    } catch (error) {
      console.error("💥 Cache exists error:", error as Error);
      return false;
    }
  }

  /**
   * ⏰ Set expiration time
   */
  public async expire(_key: string, _ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(_key, _ttl);
      return result === true;
    } catch (error) {
      console.error("💥 Cache expire error:", error as Error);
      return false;
    }
  }

  // ==========================================
  // 🏷️ TAG-BASED OPERATIONS
  // ==========================================

  /**
   * 🏷️ Invalidate by tag
   */
  public async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = await this.client.sMembers(`tag:${tag}`);

      if (keys.length > 0) {
        const result = await this.client.del(keys);
        await this.client.del(`tag:${tag}`);
        return result;
      }

      return 0;
    } catch (error) {
      console.error("💥 Tag invalidation error:", error as Error);
      return 0;
    }
  }

  /**
   * 🏷️ Get keys by tag
   */
  public async getKeysByTag(_tag: string): Promise<string[]> {
    try {
      return await this.client.sMembers(`tag:${_tag}`);
    } catch (error) {
      console.error("💥 Get keys by tag error:", error as Error);
      return [];
    }
  }

  // ==========================================
  // 🔮 PREDICTIVE CACHING
  // ==========================================

  /**
   * 🔮 Track access patterns for prediction
   */
  private trackAccessPattern(key: string): void {
    const now = Date.now();

    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }

    const pattern = this.accessPatterns.get(key)!;
    pattern.push(now);

    // Keep only last 10 accesses
    if (pattern.length > 10) {
      pattern.shift();
    }
  }

  /**
   * 🔮 Predictive loading based on patterns
   */
  private predictiveLoad(key: string, _value: any): void {
    // Store in predictive cache for faster access
    this.predictiveCache.set(key, {
      _value,
      timestamp: Date.now(),
      accessCount: (this.predictiveCache.get(key)?.accessCount || 0) + 1,
    });

    // Clean old entries
    this.cleanPredictiveCache();
  }

  /**
   * 🧹 Clean predictive cache
   */
  private cleanPredictiveCache(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    // Remove old entries by age
    for (const [key, entry] of this.predictiveCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.predictiveCache.delete(key);
      }
    }

    // Enforce size limit - remove least recently used
    if (this.predictiveCache.size > this.maxPredictiveCacheSize) {
      const entries = Array.from(this.predictiveCache.entries());
      entries.sort((_a, _b) => (_a[1].accessCount || 0) - (_b[1].accessCount || 0));

      const toRemove = entries.slice(
        0,
        this.predictiveCache.size - this.maxPredictiveCacheSize,
      );
      for (const [key] of toRemove) {
        this.predictiveCache.delete(key);
      }
    }
  }

  /**
   * 🧹 Clean access patterns
   */
  private cleanAccessPatterns(): void {
    // Enforce size limit - remove oldest patterns
    if (this.accessPatterns.size > this.maxAccessPatternsSize) {
      const entries = Array.from(this.accessPatterns.entries());
      // Sort by oldest access time
      entries.sort((a, b) => {
        const aLast = a[1].length > 0 ? a[1][a[1].length - 1] : 0;
        const bLast = b[1].length > 0 ? b[1][b[1].length - 1] : 0;
        return aLast - bLast;
      });

      const toRemove = entries.slice(
        0,
        this.accessPatterns.size - this.maxAccessPatternsSize,
      );
      for (const [key] of toRemove) {
        this.accessPatterns.delete(key);
      }
    }
  }

  /**
   * 🔄 Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanPredictiveCache();
        this.cleanAccessPatterns();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
  }

  /**
   * 🛑 Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 🚀 Get from predictive cache
   */
  public getPredictive<T = any>(_key: string): T | null {
    const entry = this.predictiveCache.get(_key);

    if (!entry) {
      return null;
    }

    // Update access count
    entry.accessCount++;

    return entry.value as T;
  }

  // ==========================================
  // 📊 BATCH OPERATIONS
  // ==========================================

  /**
   * 📦 Set multiple entries
   */
  public async setMultiple(_entries: CacheEntry[]): Promise<void> {
    try {
      const pipeline = this.client.multi();

      for (const entry of _entries) {
        const serializedValue = JSON.stringify(entry.value);
        const ttl = entry.ttl || this.config.ttl;

        pipeline.setEx(entry.key, ttl, serializedValue);

        // Handle tags
        if (entry.tags && entry.tags.length > 0) {
          for (const tag of entry.tags) {
            pipeline.sAdd(`tag:${tag}`, entry.key);
          }
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error("💥 Batch set error:", error as Error);
    }
  }

  /**
   * 📦 Get multiple entries
   */
  public async getMultiple<T = any>(keys: string[]): Promise<Map<string, T>> {
    try {
      const values = await this.client.mGet(keys);
      const result = new Map<string, T>();

      keys.forEach((key, _index) => {
        const value = values[_index];
        if (value) {
          try {
            result.set(key, JSON.parse(value));
          } catch (parseError) {
            console.error(`💥 Parse error for key ${key}:`, parseError as Error);
          }
        }
      });

      return result;
    } catch (error) {
      console.error("💥 Batch get error:", error as Error);
      return new Map();
    }
  }

  /**
   * 🗑️ Delete multiple entries
   */
  public async deleteMultiple(keys: string[]): Promise<number> {
    try {
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);

      // Remove from tags
      const tagKeys = await this.client.keys("tag:*");
      for (const tagKey of tagKeys) {
        for (const key of keys) {
          await this.client.sRem(tagKey, key);
        }
      }

      return result;
    } catch (error) {
      console.error("💥 Batch delete error:", error as Error);
      return 0;
    }
  }

  // ==========================================
  // 📈 CACHE ANALYTICS
  // ==========================================

  /**
   * 📊 Get cache statistics
   */
  public async getStatistics(): Promise<any> {
    try {
      const info = await this.client.info();
      const parsedInfo = this.parseRedisInfo(info);

      return {
        connected: this.isConnected,
        predictiveCacheSize: this.predictiveCache.size,
        accessPatternsTracked: this.accessPatterns.size,
        redis: {
          version: parsedInfo.redis_version,
          uptime: parsedInfo.uptime_in_seconds,
          connected_clients: parsedInfo.connected_clients,
          used_memory: parsedInfo.used_memory,
          total_connections_received: parsedInfo.total_connections_received,
        },
      };
    } catch (error) {
      console.error("💥 Statistics error:", error as Error);
      return {
        connected: this.isConnected,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 📈 Get hit/miss ratio
   */
  public async getHitRatio(): Promise<any> {
    try {
      const info = await this.client.info();
      const parsedInfo = this.parseRedisInfo(info);

      const hits = parseInt(parsedInfo.keyspace_hits || "0");
      const misses = parseInt(parsedInfo.keyspace_misses || "0");
      const total = hits + misses;

      return {
        hits,
        misses,
        total,
        ratio: total > 0 ? (hits / total) * 100 : 0,
      };
    } catch (error) {
      console.error("💥 Hit ratio error:", error as Error);
      return {
        hits: 0,
        misses: 0,
        total: 0,
        ratio: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================
  // 🔧 UTILITY METHODS
  // ==========================================

  /**
   * 🧹 Clear all cache with Redis resilience
   */
  public async clear(): Promise<void> {
    try {
      // Check if client is connected, if not try to reconnect
      if (!this.isConnected || !this.client.isReady) {
        console.log(
          "🔄 Selene Cache client not ready, attempting reconnection...",
        );
        await this.ensureConnection();
      }

      if (this.isConnected && this.client.isReady) {
        // 🧠 SELECTIVE CLEAR: Preserve consciousness memory while clearing swarm cache
        console.log("🧹 Performing SELECTIVE Redis cleanup...");
        
        // Get all keys to identify what to delete
        const allKeys = await this.client.keys('*');
        const keysToDelete: string[] = [];
        const consciousnessKeys: string[] = [];
        
        for (const key of allKeys) {
          // PRESERVE consciousness memory and patterns
          if (key.startsWith('selene:consciousness:')) {
            consciousnessKeys.push(key);
            continue; // Skip deletion
          }
          
          // DELETE everything else (swarm nodes, consensus, temporary cache)
          keysToDelete.push(key);
        }
        
        // Delete non-consciousness keys in batches
        if (keysToDelete.length > 0) {
          // Redis DEL accepts multiple keys, but we need to handle them properly
          for (const key of keysToDelete) {
            await this.client.del(key);
          }
          console.log(`🧹 Deleted ${keysToDelete.length} cache keys (swarm/consensus/temp)`);
        }
        
        if (consciousnessKeys.length > 0) {
          console.log(`🧠 Preserved ${consciousnessKeys.length} consciousness keys (memory intact)`);
        }
      } else {
        console.log("⚠️ Redis unavailable, clearing local cache only");
      }

      this.predictiveCache.clear();
      this.accessPatterns.clear();
      console.log(
        "🧹 Selene Cache cleared (Redis: " +
          (this.isConnected ? "selective" : "local only") +
          ")",
      );
    } catch (error) {
      console.error("💥 Selene Cache clear error:", error as Error);
      // Clear local cache even if Redis fails
      this.predictiveCache.clear();
      this.accessPatterns.clear();
      console.log("🧹 Local cache cleared (Redis failed)");
    }
  }

  /**
   * 🔍 Search keys by pattern
   */
  public async searchKeys(_pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(_pattern);
    } catch (error) {
      console.error("💥 Key search error:", error as Error);
      return [];
    }
  }

  /**
   * 📊 Get cache status with Redis resilience
   */
  public async getStatus(): Promise<any> {
    let redisConnected = false;

    try {
      if (this.isConnected && this.client.isReady) {
        await this.client.ping();
        redisConnected = true;
      }
    } catch (error) {
      // Don't spam console with ping errors
      redisConnected = false;
    }

    return {
      connected: redisConnected,
      predictiveCache: {
        size: this.predictiveCache.size,
        maxAge: 30 * 60 * 1000, // 30 minutes
      },
      accessPatterns: {
        tracked: this.accessPatterns.size,
      },
      redis: {
        host: this.config.host,
        port: this.config.port,
        connected: redisConnected,
      },
      connectionId: this.connectionId,
    };
  }

  /**
   * 🔧 Parse Redis info string
   */
  private parseRedisInfo(_info: string): any {
    const lines = _info.split("\n");
    const result: any = {};

    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":");
        result[key] = value;
      }
    }

    return result;
  }
}


