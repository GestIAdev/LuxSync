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
    applyMicHeadroom(buffer) {
        let peak = 0;
        for (let i = 0; i < buffer.length; i++) {
            const abs = Math.abs(buffer[i]);
            if (abs > peak)
                peak = abs;
        }
        if (peak > LegacyBridgeProvider.HEADROOM_THRESHOLD) {
            const scale = LegacyBridgeProvider.TARGET_HEADROOM / peak;
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] *= scale;
            }
        }
    }
    feedFromIPC(buffer) {
        if (this._status.state !== 'streaming')
            return;
        this.samplesProcessed += buffer.length;
        this.bufferCount++;
        // WAVE 3421: reducir headroom del MIC antes de escribir al SAB
        this.applyMicHeadroom(buffer);
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
/**
 * Called by the IPC handler (IPCHandlers.ts) when a lux:audio-buffer arrives.
 * This replaces the direct trinity.feedAudioBuffer(buffer) call.
 *
 * WAVE 3421 — MIC Headroom Soft-Limiter:
 * WebAudio entrega buffers del MIC ya clampeados a 1.0 (hard clip digital).
 * Esto genera in_peak=1.00000 en cada frame del Worker — la dinámica del MIC
 * queda destruida y el AGC no puede normalizar porque el peak tracker
 * siempre ve 1.0 (maxGain se queda en minGain=0.5 → contradictorio).
 *
 * Fix: si el peak absoluto del buffer supera HEADROOM_THRESHOLD (0.85),
 * escalar el BUFFER COMPLETO in-place a TARGET_HEADROOM (0.72) preservando
 * la forma de onda y la relación peak/RMS que necesita el AGC.
 * Seguro: el MIC no alimenta rawBassEnergy del IntervalBPMTracker (ese viene
 * del VirtualWire/WASAPI que tiene su propio path al SAB — WAVE 3411).
 */
LegacyBridgeProvider.HEADROOM_THRESHOLD = 0.85;
LegacyBridgeProvider.TARGET_HEADROOM = 0.72; // −2.85 dBFS de headroom
