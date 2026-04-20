// WAVE 3401: LEGACY BRIDGE PROVIDER
//
// Wraps the existing Electron IPC audio pipeline (lux:audio-buffer) as an
// IInputProvider for the Omni-Input Matrix. This is the backward-compatible
// bridge that keeps the current useAudioCapture.ts → IPC → TitanOrchestrator
// pipeline working as a first-class provider.
//
// When LegacyBridge is the active source, audio still enters through the
// renderer's Web Audio API and crosses the IPC boundary via Uint8Array.
// The difference: instead of postMessage to BETA Worker, the buffer goes
// through AudioMatrix → SharedRingBuffer → BETA Worker (zero-copy).
//
// This provider is always available as the fallback of last resort.
export class LegacyBridgeProvider {
    constructor() {
        this.type = 'legacy-bridge';
        this._status = {
            state: 'uninitialized',
            deviceName: null,
            sampleRate: 44100,
            channels: 1,
            latencyMs: 0,
            errorMessage: null,
        };
        // Callbacks wired by AudioMatrix
        this.onAudioData = null;
        this.onStatusChange = null;
        // Telemetry
        this.samplesProcessed = 0;
        this.bufferCount = 0;
        this.startTime = 0;
        this.peakLatencyMs = 0;
        this.totalLatencyMs = 0;
    }
    get status() {
        return this._status;
    }
    async initialize(_config) {
        this.updateStatus({
            state: 'ready',
            deviceName: 'Electron IPC (useAudioCapture)',
            sampleRate: 44100,
            channels: 1,
            latencyMs: 0,
            errorMessage: null,
        });
    }
    async start() {
        this.startTime = Date.now();
        this.updateStatus({
            ...this._status,
            state: 'streaming',
        });
    }
    async stop() {
        this.updateStatus({
            ...this._status,
            state: 'ready',
        });
    }
    dispose() {
        this.onAudioData = null;
        this.onStatusChange = null;
        this.updateStatus({
            ...this._status,
            state: 'disposed',
        });
    }
    /**
     * Called by the IPC handler (IPCHandlers.ts) when a lux:audio-buffer arrives.
     * This replaces the direct trinity.feedAudioBuffer(buffer) call.
     */
    feedFromIPC(buffer) {
        if (this._status.state !== 'streaming')
            return;
        this.samplesProcessed += buffer.length;
        this.bufferCount++;
        if (this.onAudioData) {
            this.onAudioData(buffer, this._status.sampleRate);
        }
    }
    async enumerateDevices() {
        // Legacy bridge uses whatever the renderer's Web Audio API is capturing.
        // Device enumeration happens on the renderer side, not here.
        return [{
                id: 'legacy-ipc',
                name: 'Electron IPC (Web Audio API)',
                sampleRate: 44100,
                channels: 1,
                isDefault: true,
            }];
    }
    getDiagnostics() {
        const uptimeMs = this.startTime > 0 ? Date.now() - this.startTime : 0;
        return {
            bufferUnderruns: 0,
            bufferOverruns: 0,
            samplesProcessed: this.samplesProcessed,
            avgLatencyMs: this.bufferCount > 0 ? this.totalLatencyMs / this.bufferCount : 0,
            peakLatencyMs: this.peakLatencyMs,
            uptimeMs,
        };
    }
    updateStatus(newStatus) {
        this._status = newStatus;
        if (this.onStatusChange) {
            this.onStatusChange(newStatus);
        }
    }
}
