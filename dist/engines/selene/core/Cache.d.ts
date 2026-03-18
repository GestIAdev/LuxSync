/**
 * ⚡ SELENE CACHE - DISTRIBUTED INTELLIGENCE MODULE
 * By PunkClaude & RaulVisionario - September 18, 2025
 *
 * MISSION: Intelligent distributed caching system
 * STRATEGY: Redis-powered cache with predictive loading
 */
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
export declare class SeleneCache {
    private client;
    private config;
    private isConnected;
    private connectionId;
    private predictiveCache;
    private accessPatterns;
    private maxPredictiveCacheSize;
    private maxAccessPatternsSize;
    private cleanupInterval;
    constructor();
    /**
     * � Ensure Redis connection is active
     */
    private ensureConnection;
    /**
     * � Connect to Redis
     */
    connect(): Promise<void>;
    /**
     * 🔌 Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * 💾 Set cache entry
     */
    set(key: string, value: any, _ttl?: number, tags?: string[]): Promise<void>;
    /**
     * 📖 Get cache entry
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * 🗑️ Delete cache entry
     */
    delete(key: string): Promise<boolean>;
    /**
     * 🔍 Check if key exists
     */
    exists(_key: string): Promise<boolean>;
    /**
     * ⏰ Set expiration time
     */
    expire(_key: string, _ttl: number): Promise<boolean>;
    /**
     * 🏷️ Invalidate by tag
     */
    invalidateByTag(tag: string): Promise<number>;
    /**
     * 🏷️ Get keys by tag
     */
    getKeysByTag(_tag: string): Promise<string[]>;
    /**
     * 🔮 Track access patterns for prediction
     */
    private trackAccessPattern;
    /**
     * 🔮 Predictive loading based on patterns
     */
    private predictiveLoad;
    /**
     * 🧹 Clean predictive cache
     */
    private cleanPredictiveCache;
    /**
     * 🧹 Clean access patterns
     */
    private cleanAccessPatterns;
    /**
     * 🔄 Start cleanup interval
     */
    private startCleanupInterval;
    /**
     * 🛑 Stop cleanup interval
     */
    private stopCleanupInterval;
    /**
     * 🚀 Get from predictive cache
     */
    getPredictive<T = any>(_key: string): T | null;
    /**
     * 📦 Set multiple entries
     */
    setMultiple(_entries: CacheEntry[]): Promise<void>;
    /**
     * 📦 Get multiple entries
     */
    getMultiple<T = any>(keys: string[]): Promise<Map<string, T>>;
    /**
     * 🗑️ Delete multiple entries
     */
    deleteMultiple(keys: string[]): Promise<number>;
    /**
     * 📊 Get cache statistics
     */
    getStatistics(): Promise<any>;
    /**
     * 📈 Get hit/miss ratio
     */
    getHitRatio(): Promise<any>;
    /**
     * 🧹 Clear all cache with Redis resilience
     */
    clear(): Promise<void>;
    /**
     * 🔍 Search keys by pattern
     */
    searchKeys(_pattern: string): Promise<string[]>;
    /**
     * 📊 Get cache status with Redis resilience
     */
    getStatus(): Promise<any>;
    /**
     * 🔧 Parse Redis info string
     */
    private parseRedisInfo;
}
export {};
//# sourceMappingURL=Cache.d.ts.map