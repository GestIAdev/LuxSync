// WAVE 3402: Native Audio Bridge
//
// TypeScript wrapper around the native C++ addon (luxsync_audio).
// Provides a clean async interface for device enumeration, capture,
// and hot-plug detection. Handles native module loading with graceful
// fallback when the addon isn't compiled.
//
// This bridge is consumed by VirtualWireProvider and USBDirectLinkProvider.
// ============================================
// NativeAudioBridge
// ============================================
export class NativeAudioBridge {
    constructor() {
        this.addon = null;
        this.activeCaptures = new Map();
        this.deviceChangeListeners = new Set();
        this._available = false;
        this._loadError = null;
        this.deviceWatcherActive = false;
        this.loadNativeAddon();
    }
    /**
     * Whether the native addon is available and loaded
     */
    get available() {
        return this._available;
    }
    /**
     * Error message if native addon failed to load
     */
    get loadError() {
        return this._loadError;
    }
    /**
     * Enumerate all audio input devices (physical + virtual/loopback)
     */
    enumerateDevices() {
        if (!this.addon) {
            console.error('[NativeAudio] enumerateDevices() called but addon not loaded');
            return [];
        }
        const nativeDevices = this.addon.enumerateDevices();
        // ─── LIFT LOG BLACKOUT: dump full device table ───────────────────────────
        console.log(`[NativeAudio] Device enumeration — ${nativeDevices.length} device(s) found:`);
        for (const dev of nativeDevices) {
            const flags = [
                dev.isDefault ? 'DEFAULT' : null,
                dev.isLoopback ? 'LOOPBACK' : null,
                dev.isExclusiveCapable ? 'EXCLUSIVE' : null,
            ].filter(Boolean).join(', ') || 'shared-only';
            console.log(`[NativeAudio]   [${dev.driver.toUpperCase()}] "${dev.name}"` +
                ` | ${dev.channels}ch @ ${dev.sampleRate}Hz` +
                ` | flags: [${flags}]` +
                ` | supported rates: [${dev.sampleRates.join(', ')}]` +
                ` | id: ${dev.id}`);
        }
        const loopbacks = nativeDevices.filter(d => d.isLoopback);
        if (loopbacks.length === 0) {
            console.warn('[NativeAudio] ⚠️  No loopback/virtual-cable devices detected. VirtualWire will be unavailable.');
        }
        else {
            console.log(`[NativeAudio] ✅ Loopback device(s) detected: ${loopbacks.map(d => `"${d.name}"`).join(', ')}`);
        }
        // ─────────────────────────────────────────────────────────────────────────
        return nativeDevices.map((dev) => ({
            id: dev.id,
            name: dev.name,
            sampleRate: dev.sampleRate,
            channels: dev.channels,
            isDefault: dev.isDefault,
            isLoopback: dev.isLoopback,
            isExclusiveCapable: dev.isExclusiveCapable,
            driver: dev.driver,
            sampleRates: Object.freeze([...dev.sampleRates]),
        }));
    }
    /**
     * Start audio capture from a device.
     *
     * @param config  Capture configuration
     * @param onData  Callback receiving Float32Array audio chunks
     * @returns CaptureHandle for stopping the capture, or null if unavailable
     */
    startCapture(config, onData) {
        if (!this.addon) {
            console.error('[NativeAudio] startCapture() called but addon not loaded');
            return null;
        }
        console.log(`[NativeAudio] startCapture — device: "${config.deviceId || 'default'}"` +
            ` | ${config.channels}ch @ ${config.sampleRate}Hz` +
            ` | bufferSize: ${config.bufferSizeFrames} frames` +
            ` | exclusive: ${config.exclusiveMode}`);
        // Wrap the user callback in a try/catch so any JS exception thrown inside
        // it is caught and logged rather than propagating up through N-API and
        // triggering an uncaught DEP0168 deprecation warning.
        const safeOnData = (data, frameCount, channels, sampleRate) => {
            try {
                onData(data, frameCount, channels, sampleRate);
            }
            catch (err) {
                console.error('[NativeAudio] ❌ Uncaught exception in audio callback — this would have caused DEP0168:', err);
            }
        };
        let handle;
        try {
            handle = this.addon.startCapture(config, safeOnData);
        }
        catch (err) {
            console.error(`[NativeAudio] ❌ startCapture FAILED for device "${config.deviceId || 'default'}": ${err}`);
            return null;
        }
        const captureHandle = {
            id: handle,
            deviceId: config.deviceId,
            sampleRate: config.sampleRate,
            exclusiveMode: config.exclusiveMode,
            stop: () => {
                this.stopCapture(handle);
            },
        };
        this.activeCaptures.set(handle, captureHandle);
        return captureHandle;
    }
    /**
     * Stop a specific capture stream
     */
    stopCapture(handle) {
        if (!this.addon)
            return;
        this.addon.stopCapture(handle);
        this.activeCaptures.delete(handle);
    }
    /**
     * Stop all active captures
     */
    stopAll() {
        for (const [handle] of this.activeCaptures) {
            this.stopCapture(handle);
        }
    }
    /**
     * Register for device topology change notifications (hot-plug/unplug)
     */
    onDeviceChange(listener) {
        this.deviceChangeListeners.add(listener);
        this.ensureDeviceWatcher();
    }
    /**
     * Remove a device change listener
     */
    offDeviceChange(listener) {
        this.deviceChangeListeners.delete(listener);
    }
    /**
     * Get count of active capture streams
     */
    get activeCaptureCount() {
        return this.activeCaptures.size;
    }
    /**
     * Dispose — stop all captures and cleanup
     */
    dispose() {
        this.stopAll();
        this.deviceChangeListeners.clear();
        this.addon = null;
        this._available = false;
    }
    // ============================================
    // PRIVATE
    // ============================================
    loadNativeAddon() {
        console.log('[NativeAudio] Loading native addon luxsync_audio...');
        try {
            // The native addon is built by node-gyp into native/build/Release/
            // bindings() searches relative to __dirname of the calling module.
            // In Electron main process (Vite bundle), __dirname = dist-electron/,
            // so we must tell bindings where the native/ module root actually is.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require('path');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { app } = require('electron');
            const nativeRoot = path.join(app.getAppPath(), 'native');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const bindings = require('bindings');
            this.addon = bindings({ bindings: 'luxsync_audio', module_root: nativeRoot });
            this._available = true;
            this._loadError = null;
            console.log('[NativeAudio] ✅ Native addon loaded successfully');
        }
        catch (err) {
            this.addon = null;
            this._available = false;
            this._loadError = err instanceof Error ? err.message : String(err);
            console.error('[NativeAudio] ❌ Native addon FAILED to load — ' +
                'VirtualWire and USBDirectLink will be unavailable.\n' +
                `  Error: ${this._loadError}`);
        }
    }
    ensureDeviceWatcher() {
        if (this.deviceWatcherActive || !this.addon)
            return;
        this.addon.onDeviceChange(() => {
            for (const listener of this.deviceChangeListeners) {
                listener();
            }
        });
        this.deviceWatcherActive = true;
    }
}
// ============================================
// Singleton instance
// ============================================
let _instance = null;
export function getNativeAudioBridge() {
    if (!_instance) {
        _instance = new NativeAudioBridge();
    }
    return _instance;
}
