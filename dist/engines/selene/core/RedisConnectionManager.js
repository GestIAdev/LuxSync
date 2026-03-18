/**
 * 🔴 REDIS CONNECTION MANAGER - THE ANCHOR BREAKER
 * By PunkClaude - October 3, 2025
 *
 * MISSION: Break the cursed anchor causing memory leaks
 * STRATEGY: Connection pooling with context-based reuse and automatic cleanup
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
import { createClient as createRedisClient } from "redis";
/**
 * 🔴 REDIS CONNECTION MANAGER
 * The anchor breaker - prevents memory leaks from open Redis connections
 */
export class RedisConnectionManager {
    static instance;
    config;
    connectionPools = new Map();
    connectionCounter = 0;
    cleanupInterval = null;
    // Pool configuration
    DEFAULT_MAX_CONNECTIONS_PER_CONTEXT = 5;
    MAX_TOTAL_CONNECTIONS = 50;
    constructor() {
        console.log("[REDIS] Initializing Redis Connection Manager");
        this.config = {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || "0"),
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        };
        // Start cleanup interval (every 5 minutes)
        this.startCleanupInterval();
    }
    /**
     * 🚀 Get singleton instance
     */
    static getInstance() {
        if (!RedisConnectionManager.instance) {
            RedisConnectionManager.instance = new RedisConnectionManager();
        }
        return RedisConnectionManager.instance;
    }
    /**
     * � Get or create connection pool for context
     */
    getConnectionPool(context) {
        if (!this.connectionPools.has(context)) {
            this.connectionPools.set(context, {
                clients: [],
                maxConnections: this.DEFAULT_MAX_CONNECTIONS_PER_CONTEXT,
            });
        }
        return this.connectionPools.get(context);
    }
    /**
     * 🔌 Get total active connections across all pools
     */
    getTotalActiveConnections() {
        let total = 0;
        for (const pool of this.connectionPools.values()) {
            total += pool.clients.filter(client => client.isConnected).length;
        }
        return total;
    }
    /**
     * 🔌 Add connection to pool
     */
    addConnectionToPool(context, connectionInfo) {
        const pool = this.getConnectionPool(context);
        pool.clients.push(connectionInfo);
    }
    /**
     * 🔌 Remove connection from pool
     */
    removeConnectionFromPool(context, connectionId) {
        const pool = this.connectionPools.get(context);
        if (pool) {
            pool.clients = pool.clients.filter(client => client.id !== connectionId);
        }
    }
    /**
     * 🔌 Find connection info by ID or client reference
     */
    findConnectionInfo(connectionId, client) {
        for (const pool of this.connectionPools.values()) {
            for (const info of pool.clients) {
                if ((connectionId && info.id === connectionId) || (client && info.client === client)) {
                    return info;
                }
            }
        }
        return null;
    }
    /**
     * 🔌 Get available connection from pool
     */
    getAvailableConnection(context, type, isSubscriber = false) {
        const pool = this.connectionPools.get(context);
        if (!pool)
            return null;
        // Find available connection of the right type
        for (const client of pool.clients) {
            if (client.type === type && client.isSubscriber === isSubscriber && client.isConnected) {
                client.lastUsed = new Date();
                return client;
            }
        }
        return null;
    }
    /**
     * 🔌 Create mock subscriber client for error cases
     */
    createMockSubscriberClient() {
        return {
            status: "error",
            connect: async () => { },
            disconnect: async () => { },
            ping: async () => "MOCK",
            on: () => { },
            subscribe: () => { },
            psubscribe: () => { },
            unsubscribe: () => { },
            punsubscribe: () => { },
        };
    }
    /**
     * 🔌 Create mock client for error cases
     */
    createMockClient() {
        return {
            status: "error",
            connect: async () => { },
            disconnect: async () => { },
            ping: async () => "MOCK",
            on: () => { },
        };
    }
    /**
     * 🔌 Create new Redis client (redis package) - with pool management
     */
    createRedisClient(context = "unknown") {
        // Check if we can create more connections
        if (this.getTotalActiveConnections() >= this.MAX_TOTAL_CONNECTIONS) {
            console.warn("[REDIS]", `⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new Redis client`);
            return null;
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn("[REDIS]", `⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new Redis client`);
            return null;
        }
        const connectionId = `${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log("[REDIS]", `🔌 Creating Redis client: ${connectionId}`);
        const client = createRedisClient({
            url: `redis://${this.config.host}:${this.config.port}`,
            password: this.config.password,
            database: this.config.db,
        });
        // Create connection info
        const connectionInfo = {
            id: connectionId,
            client,
            type: "redis",
            created: new Date(),
            lastUsed: new Date(),
            isConnected: false,
        };
        // Add to pool
        this.addConnectionToPool(context, connectionInfo);
        // Handle events
        client.on("connect", () => {
            console.log("[REDIS]", `✅ Redis client connected: ${connectionId}`);
            this.updateConnectionStatus(connectionId, true);
        });
        client.on("error", (_error) => {
            console.error(" [REDIS]", `💥 Redis client error ${connectionId}:`, _error.message);
            this.updateConnectionStatus(connectionId, false);
        });
        client.on("disconnect", () => {
            console.log("[REDIS]", `🔌 Redis client disconnected: ${connectionId}`);
            this.updateConnectionStatus(connectionId, false);
        });
        return client;
    }
    /**
     * 🔌 Create new IORedis client (ioredis package) - with pool management
     */
    createIORedisClient(context = "unknown") {
        // Check if we can create more connections
        if (this.getTotalActiveConnections() >= this.MAX_TOTAL_CONNECTIONS) {
            console.warn("[REDIS]", `⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new IORedis client`);
            return this.createMockClient();
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn("[REDIS]", `⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new IORedis client`);
            return this.createMockClient();
        }
        const connectionId = `${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log("[REDIS]", `🔌 Creating IORedis client: ${connectionId}`);
        try {
            const client = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                lazyConnect: true,
                maxRetriesPerRequest: null, // Disable retries to avoid socket issues
                enableReadyCheck: false,
                autoResubscribe: false,
                autoResendUnfulfilledCommands: false,
                connectionName: connectionId, // Unique connection name
            });
            // Create connection info
            const connectionInfo = {
                id: connectionId,
                client,
                type: "ioredis",
                created: new Date(),
                lastUsed: new Date(),
                isConnected: false,
            };
            // Add to pool
            this.addConnectionToPool(context, connectionInfo);
            // Handle events
            client.on("connect", () => {
                console.log("[REDIS]", `✅ IORedis client connected: ${connectionId}`);
                this.updateConnectionStatus(connectionId, true);
            });
            client.on("error", (error) => {
                console.error(`💥 IORedis client error ${connectionId}:`, error.message);
                this.updateConnectionStatus(connectionId, false);
            });
            client.on("close", () => {
                console.log("[REDIS]", `🔌 IORedis client closed: ${connectionId}`);
                this.updateConnectionStatus(connectionId, false);
            });
            return client;
        }
        catch (error) {
            console.error(`💥 Failed to create IORedis client ${connectionId}:`, error);
            return this.createMockClient();
        }
    }
    /**
     * 🔌 Create new IORedis subscriber client (ioredis package) - with pool management
     */
    createIORedisSubscriberClient(context = "subscriber") {
        // Check if we can create more connections
        if (this.getTotalActiveConnections() >= this.MAX_TOTAL_CONNECTIONS) {
            console.warn("[REDIS]", `⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new IORedis subscriber client`);
            return this.createMockSubscriberClient();
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn("[REDIS]", `⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new IORedis subscriber client`);
            return this.createMockSubscriberClient();
        }
        const connectionId = `subscriber_${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log("[REDIS]", `🔌 Creating IORedis subscriber client: ${connectionId}`);
        try {
            const client = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                lazyConnect: true,
                maxRetriesPerRequest: null, // Disable retries to avoid socket issues
                enableReadyCheck: false,
                autoResubscribe: false,
                autoResendUnfulfilledCommands: false,
                connectionName: connectionId, // Unique connection name
            });
            // Create connection info as subscriber
            const connectionInfo = {
                id: connectionId,
                client,
                type: "ioredis",
                created: new Date(),
                lastUsed: new Date(),
                isConnected: false,
                isSubscriber: true, // Mark as subscriber connection
            };
            // Add to pool
            this.addConnectionToPool(context, connectionInfo);
            // Handle events
            client.on("connect", () => {
                console.log("[REDIS]", `✅ IORedis subscriber client connected: ${connectionId}`);
                this.updateConnectionStatus(connectionId, true);
            });
            client.on("error", (error) => {
                console.error(`💥 IORedis subscriber client error ${connectionId}:`, error.message);
                this.updateConnectionStatus(connectionId, false);
            });
            client.on("close", () => {
                console.log("[REDIS]", `🔌 IORedis subscriber client closed: ${connectionId}`);
                this.updateConnectionStatus(connectionId, false);
            });
            return client;
        }
        catch (error) {
            console.error(`💥 Failed to create IORedis subscriber client ${connectionId}:`, error);
            return this.createMockSubscriberClient();
        }
    }
    /**
     * 🔌 Get existing client by context (reuse if possible) - pool-based
     */
    getRedisClient(context) {
        // Try to get available connection from pool
        const availableConnection = this.getAvailableConnection(context, "redis");
        if (availableConnection) {
            return availableConnection.client;
        }
        // If no available connection, create new one
        return this.createRedisClient(context);
    }
    /**
     * 🔌 Get existing IORedis client by context (reuse if possible) - pool-based
     */
    getIORedisClient(context) {
        // Try to get available connection from pool (exclude subscribers)
        const availableConnection = this.getAvailableConnection(context, "ioredis", false);
        if (availableConnection) {
            return availableConnection.client;
        }
        // If no available connection, create new one
        return this.createIORedisClient(context);
    }
    /**
     * 🔌 Get existing IORedis subscriber client by context (reuse if possible) - pool-based
     */
    getIORedisSubscriberClient(context) {
        // Try to get available subscriber connection from pool
        const availableConnection = this.getAvailableConnection(context, "ioredis", true);
        if (availableConnection) {
            return availableConnection.client;
        }
        // If no available connection, create new one
        return this.createIORedisSubscriberClient(context);
    }
    /**
     * 🔌 Ensure connection is active
     */
    /**
     * 🔥 SANITACIÓN-QUIRÚRGICA: Exponential Backoff Retry Logic
     * Ensures connection with silent retries for warm-up race conditions
     */
    async ensureConnection(client, connectionId, maxRetries = 3, initialDelay = 200) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // ATTEMPT CONNECTION WITH EXISTING LOGIC
                return await this._attemptConnection(client, connectionId);
            }
            catch (error) {
                // FINAL ATTEMPT FAILED - LOG AS ERROR
                if (attempt === maxRetries) {
                    console.error(" [REDIS]", `💥 Connection failed after ${maxRetries} retries for ${connectionId}`, error);
                    if (connectionId) {
                        this.updateConnectionStatus(connectionId, false);
                    }
                    return false;
                }
                // CALCULATE BACKOFF DELAY
                const delay = initialDelay * Math.pow(2, attempt - 1);
                // SILENT RETRY - Use DEBUG for first attempt, WARN for subsequent
                if (attempt === 1) {
                    console.log("REDIS", `Connection failed (Warm-Up Race?). Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`, { connectionId, error: String(error) });
                }
                else {
                    console.warn("REDIS", `⏳ Connection retry ${attempt}/${maxRetries} in ${delay}ms...`, { connectionId });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false; // Should never reach here
    }
    /**
     * 🔌 INTERNAL: Single connection attempt (original logic)
     */
    async _attemptConnection(client, connectionId) {
        try {
            // Find the connection info
            const connectionInfo = this.findConnectionInfo(connectionId, client);
            // If we have connection info and there's an ongoing connection attempt, wait for it
            if (connectionInfo?.connecting) {
                console.log(`🔌 Waiting for ongoing connection attempt for ${connectionId}`);
                return await connectionInfo.connecting;
            }
            if (client instanceof Redis) {
                // IORedis - check status more carefully
                const status = client.status;
                console.log(`🔌 Checking IORedis status: ${status} for connection ${connectionId}`);
                // If already connected and ready, just test with ping
                if (status === "ready") {
                    try {
                        console.log("[REDIS]", `✅ IORedis connection ${connectionId} already active`);
                        await client.ping();
                        return true;
                    }
                    catch (pingError) {
                        console.log(`⚠️ IORedis ping failed despite ready status, attempting reconnect...`);
                        // Fall through to reconnect logic
                    }
                }
                // If connecting, wait for connection to complete with strict timeout
                if (status === "connecting") {
                    console.log("[REDIS]", `🔌 Waiting for IORedis connection ${connectionId}...`);
                    const connectionPromise = new Promise((_resolve, reject) => {
                        const timeout = setTimeout(() => {
                            console.error(`⏰ Connection timeout after 10 seconds for ${connectionId}`);
                            reject(new Error("Connection timeout"));
                        }, 10000); // 🔥 SANITACIÓN-QUIRÚRGICA: Increased from 3s to 10s for 3-node simultaneous startup
                        const checkStatus = () => {
                            const currentStatus = client.status;
                            console.log(`🔍 Connection status check for ${connectionId}: ${currentStatus}`);
                            if (currentStatus === "ready") {
                                clearTimeout(timeout);
                                console.log("[REDIS]", `✅ Connection ready for ${connectionId}`);
                                _resolve(true);
                            }
                            else if (currentStatus === "close" || currentStatus === "end") {
                                clearTimeout(timeout);
                                console.error(`❌ Connection failed for ${connectionId}: ${currentStatus}`);
                                reject(new Error("Connection failed"));
                            }
                            else {
                                // Continue checking every 200ms instead of 100ms
                                setTimeout(checkStatus, 200);
                            }
                        };
                        checkStatus();
                    });
                    // Store the connection promise to prevent concurrent attempts
                    if (connectionInfo) {
                        connectionInfo.connecting = connectionPromise;
                    }
                    try {
                        const result = await connectionPromise;
                        console.log("[REDIS]", `✅ IORedis connection ${connectionId} established`);
                        return result;
                    }
                    catch (error) {
                        console.error(`💥 Connection promise failed for ${connectionId}:`, error);
                        throw error;
                    }
                    finally {
                        if (connectionInfo) {
                            connectionInfo.connecting = undefined;
                        }
                    }
                }
                // Only connect if not already connected or connecting
                if (status === "close" ||
                    status === "end" ||
                    status === null ||
                    status === undefined) {
                    console.log("[REDIS]", `🔌 Connecting IORedis client ${connectionId}...`);
                    const connectionPromise = Promise.race([
                        client.connect().catch((error) => {
                            // If the error is "Socket already opened", consider it connected
                            if (error.message &&
                                error.message.includes("Socket already opened")) {
                                console.log(`✅ IORedis socket already opened for ${connectionId}, connection successful`);
                                return true;
                            }
                            throw error;
                        }),
                        new Promise((_, _reject) => setTimeout(() => _reject(new Error("Connection timeout")), 3000)),
                    ]);
                    // Store the connection promise to prevent concurrent attempts
                    if (connectionInfo) {
                        connectionInfo.connecting = connectionPromise
                            .then(() => true)
                            .catch(() => false);
                    }
                    try {
                        await connectionPromise;
                        console.log("[REDIS]", `✅ IORedis connection ${connectionId} established`);
                        return true;
                    }
                    catch (error) {
                        throw error; // Let retry logic handle it
                    }
                    finally {
                        if (connectionInfo) {
                            connectionInfo.connecting = undefined;
                        }
                    }
                }
                // For other statuses (like "wait"), test connection first with timeout
                try {
                    console.log(`🔌 Testing IORedis connection ${connectionId} (status: ${status})...`);
                    // Add timeout to ping
                    const pingPromise = client.ping();
                    const timeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Ping timeout")), 2000));
                    await Promise.race([pingPromise, timeoutPromise]);
                    console.log(`✅ IORedis connection ${connectionId} is active (status: ${status})`);
                    return true;
                }
                catch (pingError) {
                    console.log(`🔌 Reconnecting IORedis client ${connectionId} due to ping failure...`);
                    const connectionPromise = Promise.race([
                        client.connect().catch((error) => {
                            // If the error is "Socket already opened", consider it connected
                            if (error.message &&
                                error.message.includes("Socket already opened")) {
                                console.log(`✅ IORedis socket already opened for ${connectionId}, connection successful`);
                                return true;
                            }
                            throw error;
                        }),
                        new Promise((_, _reject) => setTimeout(() => _reject(new Error("Reconnection timeout")), 3000)),
                    ]);
                    // Store the connection promise to prevent concurrent attempts
                    if (connectionInfo) {
                        connectionInfo.connecting = connectionPromise
                            .then(() => true)
                            .catch(() => false);
                    }
                    try {
                        await connectionPromise;
                        console.log("[REDIS]", `✅ IORedis connection ${connectionId} reconnected`);
                        return true;
                    }
                    catch (reconnectError) {
                        console.error(`💥 Reconnection failed for ${connectionId}:`, reconnectError);
                        throw reconnectError;
                    }
                    finally {
                        if (connectionInfo) {
                            connectionInfo.connecting = undefined;
                        }
                    }
                }
            }
            else {
                // Redis client - add timeout protection
                console.log("[REDIS]", `🔌 Ensuring Redis client connection ${connectionId}...`);
                try {
                    if (!client.isReady) {
                        const connectPromise = client.connect();
                        const timeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Redis connect timeout")), 3000));
                        await Promise.race([connectPromise, timeoutPromise]);
                    }
                    const pingPromise = client.ping();
                    const pingTimeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Redis ping timeout")), 2000));
                    await Promise.race([pingPromise, pingTimeoutPromise]);
                }
                catch (error) {
                    throw error; // Let retry logic handle it
                }
            }
            if (connectionId) {
                this.updateConnectionStatus(connectionId, true);
            }
            return true;
        }
        catch (error) {
            // If the error is "Socket already opened", don't treat it as a failure
            if (error instanceof Error &&
                error.message.includes("Socket already opened")) {
                console.log("[REDIS]", `✅ IORedis socket already opened, connection successful`);
                if (connectionId) {
                    this.updateConnectionStatus(connectionId, true);
                }
                return true;
            }
            throw error; // Re-throw to trigger retry logic
        }
    }
    /**
     * 🔌 Close specific connection
     */
    async closeConnection(connectionId) {
        const info = this.findConnectionInfo(connectionId);
        if (!info)
            return;
        try {
            if (info.type === "redis") {
                await info.client.disconnect();
            }
            else {
                await info.client.disconnect();
            }
            console.log("[REDIS]", `✅ Connection closed: ${connectionId}`);
        }
        catch (error) {
            console.error(" [REDIS]", `💥 Error closing connection ${connectionId}:`, error);
        }
        finally {
            // Remove from pool
            const context = connectionId.split("_")[0];
            this.removeConnectionFromPool(context, connectionId);
        }
    }
    /**
     * 🧹 Close all connections
     */
    async closeAllConnections() {
        console.log("[REDIS]", "🧹 Closing all Redis connections...");
        const closePromises = [];
        for (const pool of this.connectionPools.values()) {
            for (const client of pool.clients) {
                closePromises.push(this.closeConnection(client.id));
            }
        }
        await Promise.allSettled(closePromises);
        console.log("[REDIS]", "✅ All Redis connections closed");
    }
    /**
     * 📊 Get connection statistics
     */
    getConnectionStats() {
        const stats = {
            total: 0,
            connected: 0,
            disconnected: 0,
            subscribers: 0,
            regular: 0,
            byType: { redis: 0, ioredis: 0 },
            byContext: {},
        };
        for (const [context, pool] of this.connectionPools.entries()) {
            for (const info of pool.clients) {
                stats.total++;
                if (info.isConnected)
                    stats.connected++;
                else
                    stats.disconnected++;
                if (info.isSubscriber)
                    stats.subscribers++;
                else
                    stats.regular++;
                stats.byType[info.type]++;
                stats.byContext[context] = (stats.byContext[context] || 0) + 1;
            }
        }
        return stats;
    }
    /**
     * 🔄 Update connection status
     */
    updateConnectionStatus(connectionId, isConnected) {
        const info = this.findConnectionInfo(connectionId);
        if (info) {
            info.isConnected = isConnected;
            info.lastUsed = new Date();
        }
    }
    /**
     * 🧹 Start cleanup interval
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(async () => {
            await this.performCleanup();
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    /**
     * 🧹 Perform cleanup of old connections
     */
    async performCleanup() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        const toClose = [];
        for (const pool of this.connectionPools.values()) {
            for (const info of pool.clients) {
                const age = now - info.lastUsed.getTime();
                if (age > maxAge && !info.isConnected) {
                    toClose.push(info.id);
                }
            }
        }
        if (toClose.length > 0) {
            console.log("[REDIS]", `🧹 Cleaning up ${toClose.length} old connections`);
            for (const id of toClose) {
                await this.closeConnection(id);
            }
        }
    }
    /**
     * � Initialize Redis Connection Manager (non-blocking)
     */
    async initializeAsync() {
        console.log("[REDIS]", "� Initializing Redis Connection Manager (async)...");
        try {
            // Try to create and test a connection quickly
            const testClient = this.createIORedisClient("test-connection");
            // Try to connect with a short timeout
            const connectionSuccess = await Promise.race([
                this.ensureConnection(testClient, "test-connection").catch(() => false),
                new Promise((_resolve) => setTimeout(() => _resolve(false), 2000)),
            ]);
            if (connectionSuccess) {
                console.log("[REDIS]", "✅ Redis Connection Manager initialized successfully");
                // Close the test connection
                await this.closeConnection("test-connection");
                return true;
            }
            else {
                console.warn("⚠️ Redis Connection Manager initialization timed out - Redis may not be available");
                return false;
            }
        }
        catch (error) {
            console.error("💥 Redis Connection Manager initialization failed:", error);
            return false;
        }
    }
}
// Export singleton instance
export const redisManager = RedisConnectionManager.getInstance();
//# sourceMappingURL=RedisConnectionManager.js.map