/**
 * 🏛️ WAVE 212 + WAVE 252: MOCK DMX DRIVER (SILENT MODE)
 *
 * A fake DMX driver for development without physical hardware.
 * WAVE 252: Now silent by default - no console spam.
 *
 * USE CASES:
 * - Development on machines without DMX interfaces
 * - Unit/integration testing
 * - Demo mode
 * - Debugging DMX output values (enable verbose mode)
 */
// ═══════════════════════════════════════════════════════════════════════════
// MOCK DRIVER (WAVE 252: SILENT BY DEFAULT)
// ═══════════════════════════════════════════════════════════════════════════
export class MockDMXDriver {
    constructor(config = {}) {
        this._state = 'disconnected';
        this.framesSent = 0;
        this.lastSendTime = 0;
        this.universeBuffers = new Map();
        // WAVE 252: Silent mode by default (no more console spam)
        this.verbose = false;
        this.config = {
            refreshRate: config.refreshRate ?? 30,
            autoReconnect: config.autoReconnect ?? true,
            reconnectDelay: config.reconnectDelay ?? 2000,
            debug: config.debug ?? false, // WAVE 252: Debug off by default
        };
        // WAVE 252: Only log in verbose mode
        this.verbose = config.debug === true;
        // Initialize with one universe
        this.universeBuffers.set(1, new Uint8Array(512));
        // WAVE 252: Single silent init message
        if (this.verbose) {
            console.log('[MockDMX] 🎭 Mock DMX Driver initialized (WAVE 252 - Silent Mode)');
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // LIFECYCLE (WAVE 252: Silent by default)
    // ─────────────────────────────────────────────────────────────────────────
    async connect() {
        this._state = 'connecting';
        // Simulate connection delay
        await this.sleep(100);
        this._state = 'connected';
        // WAVE 252: Silent - no logs unless verbose
        return true;
    }
    async close() {
        this._state = 'disconnected';
        this.universeBuffers.clear();
        // WAVE 252: Silent
    }
    // ─────────────────────────────────────────────────────────────────────────
    // DATA TRANSMISSION
    // ─────────────────────────────────────────────────────────────────────────
    send(packet) {
        if (this._state !== 'connected') {
            if (this.config.debug) {
                console.warn('[MockDMX] ⚠️ Cannot send - not connected');
            }
            return false;
        }
        const universe = packet.universe || 1;
        let buffer = this.universeBuffers.get(universe);
        if (!buffer) {
            buffer = new Uint8Array(512);
            this.universeBuffers.set(universe, buffer);
        }
        // Apply packet to buffer
        const startAddr = packet.address - 1; // Convert 1-based to 0-based
        for (let i = 0; i < packet.channels.length && startAddr + i < 512; i++) {
            buffer[startAddr + i] = Math.max(0, Math.min(255, packet.channels[i]));
        }
        this.framesSent++;
        this.lastSendTime = Date.now();
        // WAVE 252: Only log in verbose mode
        // (Removed sample logging spam)
        return true;
    }
    sendUniverse(universe, data) {
        if (this._state !== 'connected')
            return false;
        // Store the buffer
        this.universeBuffers.set(universe, new Uint8Array(data));
        this.framesSent++;
        this.lastSendTime = Date.now();
        // WAVE 252: Silent - no logging unless verbose
        return true;
    }
    blackout() {
        if (this.verbose) {
            console.log('[MockDMX] ⬛ BLACKOUT - All channels to 0');
        }
        this.universeBuffers.forEach((buffer) => {
            buffer.fill(0);
        });
    }
    /**
     * 🔥 WAVE 2020.2b: MULTI-UNIVERSE PARALLEL FLUSH
     *
     * Mock implementation - just records that all universes were "sent".
     * In reality this is a no-op since MockDriver doesn't send anywhere.
     */
    async sendAll() {
        if (this._state !== 'connected')
            return false;
        // Mock: Just increment stats for each universe
        const universeCount = this.universeBuffers.size;
        this.framesSent += universeCount;
        this.lastSendTime = Date.now();
        if (this.verbose && universeCount > 1) {
            console.log(`[MockDMX] 📡 FLUSH: ${universeCount} universes sent in parallel`);
        }
        return true;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────────
    get isConnected() {
        return this._state === 'connected';
    }
    get state() {
        return this._state;
    }
    getStatus() {
        return {
            state: this._state,
            type: 'mock',
            deviceName: 'Virtual DMX (Mock)',
            framesSent: this.framesSent,
            lastSendTime: this.lastSendTime,
            errors: 0,
            avgLatency: 0.1, // Simulated latency
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // MOCK-SPECIFIC METHODS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get current buffer state for a universe (for testing/debugging).
     */
    getUniverseBuffer(universe) {
        return this.universeBuffers.get(universe);
    }
    /**
     * Get specific channel value.
     */
    getChannelValue(universe, channel) {
        const buffer = this.universeBuffers.get(universe);
        if (!buffer || channel < 1 || channel > 512)
            return 0;
        return buffer[channel - 1];
    }
    /**
     * WAVE 252: Enable/disable verbose logging.
     */
    setLogging(enabled, _sampleRate) {
        this.verbose = enabled;
    }
    /**
     * Simulate a connection error (for testing).
     */
    simulateError() {
        this._state = 'error';
        if (this.verbose) {
            console.error('[MockDMX] 🔥 Simulated connection error!');
        }
    }
    /**
     * Reset stats.
     */
    resetStats() {
        this.framesSent = 0;
        this.lastSendTime = 0;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Export singleton for easy use
export const mockDMXDriver = new MockDMXDriver();
