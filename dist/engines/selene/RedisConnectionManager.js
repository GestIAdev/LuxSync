/**
 * 🔴 REDIS CONNECTION MANAGER - THE ANCHOR BREAKER
 * By PunkClaude - October 3, 2025
 *
 * MISSION: Break the cursed anchor causing memory leaks
 * STRATEGY: Connection pooling with context-based reuse and automatic cleanup
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const Redis = require('ioredis');
import { createClient as createRedisClient } from "redis";
// import { redisMonitor } from "./RedisMonitor.js";
const redisMonitor = {
    recordConnection: (...args) => { },
    recordPing: (...args) => { }
}; // Stub
/**
 * 🔴 REDIS CONNECTION MANAGER
 * Connection pooling system - prevents memory leaks and connection overload
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
        console.log("🔴 Initializing Redis Connection Manager with Pooling...");
        this.config = {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || "0"),
            maxRetriesPerRequest: 3,
            lazyConnect: false, // 🔥 FIX: Auto-connect on creation
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
     * 🔌 Get or create connection pool for context
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
        for (const pool of Array.from(this.connectionPools.values())) {
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
     * 🔌 Create new Redis client (redis package) - with pool management
     */
    createRedisClient(context = "unknown") {
        // Check if we can create more connections
        if (this.getTotalActiveConnections() >= this.MAX_TOTAL_CONNECTIONS) {
            console.warn(`⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new Redis client`);
            return null;
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn(`⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new Redis client`);
            return null;
        }
        const connectionId = `${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log(`🔌 Creating Redis client: ${connectionId}`);
        // 📊 TELEMETRY: Record new connection
        redisMonitor.recordConnection(connectionId);
        const client = createRedisClient();
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
            console.log(`✅ Redis client connected: ${connectionId}`);
            this.updateConnectionStatus(connectionId, true);
        });
        client.on("error", (_error) => {
            console.error(`💥 Redis client error ${connectionId}:`, _error.message);
            this.updateConnectionStatus(connectionId, false);
        });
        client.on("disconnect", () => {
            console.log(`🔌 Redis client disconnected: ${connectionId}`);
            this.updateConnectionStatus(connectionId, false);
        });
        // 🔥 CRITICAL FIX: Connect redis client automatically (redis package requires manual connect())
        client.connect().catch((error) => {
            console.error(`💥 Failed to connect Redis client ${connectionId}:`, error.message);
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
            console.warn(`⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new IORedis client`);
            return this.createMockClient();
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn(`⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new IORedis client`);
            return this.createMockClient();
        }
        const connectionId = `${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log(`🔌 Creating IORedis client: ${connectionId}`);
        // 📊 TELEMETRY: Record new connection
        redisMonitor.recordConnection(connectionId);
        try {
            const client = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                lazyConnect: false, // 🔥 FIX: Auto-connect (IORedis client)
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
                console.log(`✅ IORedis client connected: ${connectionId}`);
                this.updateConnectionStatus(connectionId, true);
            });
            client.on("error", (error) => {
                console.error(`💥 IORedis client error ${connectionId}:`, error.message);
                this.updateConnectionStatus(connectionId, false);
            });
            client.on("close", () => {
                console.log(`🔌 IORedis client closed: ${connectionId}`);
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
            console.warn(`⚠️ Maximum total connections (${this.MAX_TOTAL_CONNECTIONS}) reached, cannot create new IORedis subscriber client`);
            return this.createMockSubscriberClient();
        }
        const pool = this.getConnectionPool(context);
        if (pool.clients.length >= pool.maxConnections) {
            console.warn(`⚠️ Maximum connections (${pool.maxConnections}) for context '${context}' reached, cannot create new IORedis subscriber client`);
            return this.createMockSubscriberClient();
        }
        const connectionId = `subscriber_${context}_${++this.connectionCounter}_${Date.now()}`;
        console.log(`🔌 Creating IORedis subscriber client: ${connectionId}`);
        try {
            const client = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                lazyConnect: false, // 🔥 FIX: Auto-connect (IORedis subscriber)
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
                console.log(`✅ IORedis subscriber client connected: ${connectionId}`);
                this.updateConnectionStatus(connectionId, true);
            });
            client.on("error", (error) => {
                console.error(`💥 IORedis subscriber client error ${connectionId}:`, error.message);
                this.updateConnectionStatus(connectionId, false);
            });
            client.on("close", () => {
                console.log(`🔌 IORedis subscriber client closed: ${connectionId}`);
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
     * 🔌 Get or create IORedis client for normal operations (legacy compatibility)
     */
    getIORedisClientForNormalOps(context) {
        return this.getIORedisClient(context);
    }
    /**
     * 🔌 Get or create IORedis client for subscriptions (legacy compatibility)
     */
    getIORedisClientForSubscriptions(context) {
        return this.getIORedisSubscriberClient(context);
    }
    /**
     * 🔌 Ensure connection is active
     */
    async ensureConnection(client, connectionId) {
        try {
            // Find the connection info
            let connectionInfo;
            if (connectionId) {
                // Find connection in pools
                for (const pool of Array.from(this.connectionPools.values())) {
                    connectionInfo = pool.clients.find(client => client.id === connectionId);
                    if (connectionInfo)
                        break;
                }
            }
            else {
                // Find by client reference
                for (const pool of Array.from(this.connectionPools.values())) {
                    connectionInfo = pool.clients.find(info => info.client === client);
                    if (connectionInfo)
                        break;
                }
            }
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
                        console.log(`✅ IORedis connection ${connectionId} already active`);
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
                    console.log(`🔌 Waiting for IORedis connection ${connectionId}...`);
                    const connectionPromise = new Promise((_resolve, reject) => {
                        const timeout = setTimeout(() => {
                            console.error(`⏰ Connection timeout after 3 seconds for ${connectionId}`);
                            reject(new Error("Connection timeout"));
                        }, 3000); // Reduced from 5 to 3 seconds
                        const checkStatus = () => {
                            const currentStatus = client.status;
                            console.log(`🔍 Connection status check for ${connectionId}: ${currentStatus}`);
                            if (currentStatus === "ready") {
                                clearTimeout(timeout);
                                console.log(`✅ Connection ready for ${connectionId}`);
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
                        console.log(`✅ IORedis connection ${connectionId} established`);
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
                    console.log(`🔌 Connecting IORedis client ${connectionId}...`);
                    const connectionPromise = Promise.race([
                        client.connect().catch((error) => {
                            // If the error is "Socket already opened", the client is already connected
                            if (error.message &&
                                error.message.includes("Socket already opened")) {
                                console.log(`✅ IORedis socket already opened for ${connectionId}, treating as successful connection`);
                                // Return true to indicate successful connection
                                return Promise.resolve(true);
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
                        console.log(`✅ IORedis connection ${connectionId} established`);
                        return true;
                    }
                    catch (error) {
                        console.error(`💥 Connection failed for ${connectionId}:`, error);
                        throw error;
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
                    // Add timeout to ping (5s for Windows stability under load)
                    const pingStart = Date.now();
                    const pingPromise = client.ping();
                    const timeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Ping timeout")), 5000));
                    await Promise.race([pingPromise, timeoutPromise]);
                    const pingLatency = Date.now() - pingStart;
                    // 📊 TELEMETRY: Record successful ping
                    redisMonitor.recordPing(pingLatency, true);
                    console.log(`✅ IORedis connection ${connectionId} is active (status: ${status})`);
                    return true;
                }
                catch (pingError) {
                    // 📊 TELEMETRY: Record failed ping
                    redisMonitor.recordPing(5000, // Max timeout reached
                    false, pingError instanceof Error ? pingError.message : String(pingError));
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
                        console.log(`✅ IORedis connection ${connectionId} reconnected`);
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
                console.log(`🔌 Ensuring Redis client connection ${connectionId}...`);
                try {
                    // 🔥 CRITICAL CHECK: If client is closed, it cannot be reopened (redis package limitation)
                    if (!client.isOpen && !client.isReady) {
                        console.warn(`⚠️ Redis client is closed and cannot be reconnected (${connectionId}). Treating as failure.`);
                        // Mark as disconnected and return false (graceful degradation)
                        if (connectionId) {
                            this.updateConnectionStatus(connectionId, false);
                        }
                        return false;
                    }
                    if (!client.isReady) {
                        // 🔥 CRITICAL FIX: Wrap connect() to catch "Socket already opened" error
                        try {
                            const connectPromise = client.connect();
                            const timeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Redis connect timeout")), 3000));
                            await Promise.race([connectPromise, timeoutPromise]);
                        }
                        catch (connectError) {
                            // If socket is already opened, treat as success
                            if (connectError.message && connectError.message.includes("Socket already opened")) {
                                console.log(`✅ Redis socket already opened for ${connectionId}, treating as successful connection`);
                                // Continue to ping test
                            }
                            else if (connectError.message && connectError.message.includes("The client is closed")) {
                                console.warn(`⚠️ Redis client is closed (${connectionId}). Graceful degradation mode.`);
                                if (connectionId) {
                                    this.updateConnectionStatus(connectionId, false);
                                }
                                return false;
                            }
                            else {
                                throw connectError;
                            }
                        }
                    }
                    const pingStart = Date.now();
                    const pingPromise = client.ping();
                    const pingTimeoutPromise = new Promise((_, _reject) => setTimeout(() => _reject(new Error("Redis ping timeout")), 5000));
                    await Promise.race([pingPromise, pingTimeoutPromise]);
                    const pingLatency = Date.now() - pingStart;
                    // 📊 TELEMETRY: Record successful ping
                    redisMonitor.recordPing(pingLatency, true);
                }
                catch (error) {
                    // 📊 TELEMETRY: Record failed ping
                    redisMonitor.recordPing(5000, // Max timeout reached
                    false, error instanceof Error ? error.message : String(error));
                    console.error(`💥 Redis client connection failed ${connectionId}:`, error);
                    throw error;
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
                console.log(`✅ IORedis socket already opened, connection successful`);
                if (connectionId) {
                    this.updateConnectionStatus(connectionId, true);
                }
                return true;
            }
            console.error("💥 Connection ensure failed:", error);
            if (connectionId) {
                this.updateConnectionStatus(connectionId, false);
            }
            return false;
        }
    }
    /**
     * 🔌 Close specific connection
     */
    async closeConnection(connectionId) {
        // Find connection in pools
        for (const [context, pool] of Array.from(this.connectionPools.entries())) {
            const connectionInfo = pool.clients.find(client => client.id === connectionId);
            if (connectionInfo) {
                try {
                    if (connectionInfo.type === "redis") {
                        await connectionInfo.client.disconnect();
                    }
                    else {
                        await connectionInfo.client.disconnect();
                    }
                    console.log(`✅ Connection closed: ${connectionId}`);
                }
                catch (error) {
                    console.error(`💥 Error closing connection ${connectionId}:`, error);
                }
                finally {
                    // Remove from pool
                    this.removeConnectionFromPool(context, connectionId);
                }
                return;
            }
        }
    }
    /**
     * 🧹 Close all connections
     */
    async closeAllConnections() {
        console.log("🧹 Closing all Redis connections...");
        const closePromises = [];
        for (const [context, pool] of Array.from(this.connectionPools.entries())) {
            for (const connectionInfo of pool.clients) {
                closePromises.push(this.closeConnection(connectionInfo.id));
            }
        }
        await Promise.allSettled(closePromises);
        console.log("✅ All Redis connections closed");
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
            pools: {},
        };
        for (const [context, pool] of Array.from(this.connectionPools.entries())) {
            stats.pools[context] = {
                total: pool.clients.length,
                connected: pool.clients.filter(client => client.isConnected).length,
                maxConnections: pool.maxConnections,
            };
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
                const contextKey = context;
                stats.byContext[contextKey] = (stats.byContext[contextKey] || 0) + 1;
            }
        }
        return stats;
    }
    /**
     * 🔄 Update connection status
     */
    updateConnectionStatus(connectionId, isConnected) {
        // Find connection in pools and update status
        for (const pool of Array.from(this.connectionPools.values())) {
            const connectionInfo = pool.clients.find(client => client.id === connectionId);
            if (connectionInfo) {
                connectionInfo.isConnected = isConnected;
                connectionInfo.lastUsed = new Date();
                break;
            }
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
        for (const pool of Array.from(this.connectionPools.values())) {
            for (const connectionInfo of pool.clients) {
                const age = now - connectionInfo.lastUsed.getTime();
                if (age > maxAge && !connectionInfo.isConnected) {
                    toClose.push(connectionInfo.id);
                }
            }
        }
        if (toClose.length > 0) {
            console.log(`🧹 Cleaning up ${toClose.length} old connections`);
            for (const id of toClose) {
                await this.closeConnection(id);
            }
        }
    }
    /**
     * 🔧 Initialize Redis Connection Manager (non-blocking)
     */
    async initializeAsync() {
        console.log("🔧 Initializing Redis Connection Manager (async)...");
        try {
            // Try to create and test a connection quickly
            const testClient = this.createIORedisClient("test-connection");
            // Try to connect with a short timeout
            const connectionSuccess = await Promise.race([
                this.ensureConnection(testClient, "test-connection").catch(() => false),
                new Promise((_resolve) => setTimeout(() => _resolve(false), 2000)),
            ]);
            if (connectionSuccess) {
                console.log("✅ Redis Connection Manager initialized successfully");
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
    /**
     * 🛑 Shutdown manager
     */
    async shutdown() {
        console.log("🛑 Shutting down Redis Connection Manager...");
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        await this.closeAllConnections();
    }
}
// Export singleton instance
export const redisManager = RedisConnectionManager.getInstance();
//# sourceMappingURL=RedisConnectionManager.js.map