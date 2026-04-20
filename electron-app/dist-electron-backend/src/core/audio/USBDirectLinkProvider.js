// WAVE 3402: USB DIRECT-LINK PROVIDER
//
// IInputProvider for USB audio interfaces and consoles:
// - Behringer X32/XR/X-Air, Mackie DL, Allen & Heath dLive
// - Any USB Class Compliant audio device
// - ASIO devices (via WASAPI Exclusive fallback on Windows)
//
// Pipeline:
//   Native Capture (Exclusive Mode) → Mono Downmix → Polyphase Resampler →
//   Auto-Gain Pre-FFT → onAudioData → AudioMatrix
//
// The key difference from VirtualWireProvider: USB devices are physical hardware
// that requires exclusive mode for clean capture, and Auto-Gain is applied
// to normalize wildly varying console output levels before FFT analysis.
import { getNativeAudioBridge } from './NativeAudioBridge';
import { getResampler } from './PolyphaseResampler';
import { AutoGainProcessor } from './AutoGainProcessor';
import { OMNI_CONSTANTS } from './OmniInputTypes';
export class USBDirectLinkProvider {
    constructor() {
        this.type = 'usb-directlink';
        this._status = {
            state: 'uninitialized',
            deviceName: null,
            sampleRate: OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
            channels: OMNI_CONSTANTS.DEFAULT_CHANNELS,
            latencyMs: 0,
            errorMessage: null,
        };
        // Callbacks wired by AudioMatrix
        this.onAudioData = null;
        this.onStatusChange = null;
        // Native capture
        this.captureHandle = null;
        this.resampler = null;
        this.resampleBuffer = null;
        this.autoGain = null;
        // Config
        this.config = {};
        this.selectedDeviceId = null;
        // Telemetry
        this.samplesProcessed = 0;
        this.bufferUnderruns = 0;
        this.bufferOverruns = 0;
        this.startTime = 0;
        this.peakLatencyMs = 0;
        this.totalLatencyMs = 0;
        this.callbackCount = 0;
        // Device hot-plug handler
        this.deviceChangeHandler = null;
    }
    get status() {
        return this._status;
    }
    async initialize(config) {
        this.config = config;
        const bridge = getNativeAudioBridge();
        if (!bridge.available) {
            this.updateStatus({
                state: 'error',
                deviceName: null,
                sampleRate: OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
                channels: OMNI_CONSTANTS.DEFAULT_CHANNELS,
                latencyMs: 0,
                errorMessage: `Native addon not available: ${bridge.loadError}`,
            });
            return;
        }
        // Enumerate once — reused for device selection AND name lookup to avoid double COM roundtrip
        const devices = bridge.enumerateDevices();
        // Select device: explicit ID, or auto-detect USB audio device
        if (config.deviceId) {
            this.selectedDeviceId = config.deviceId;
        }
        else {
            const usbDevice = devices.find(d => !d.isLoopback && d.isExclusiveCapable && !d.isDefault) ??
                devices.find(d => !d.isLoopback && d.isExclusiveCapable) ??
                null;
            if (usbDevice) {
                this.selectedDeviceId = usbDevice.id;
            }
        }
        const targetRate = config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE;
        // Initialize Auto-Gain for the target sample rate
        this.autoGain = new AutoGainProcessor(targetRate);
        const deviceName = this.selectedDeviceId
            ? (devices.find(d => d.id === this.selectedDeviceId)?.name ?? null)
            : null;
        this.updateStatus({
            state: 'ready',
            deviceName: deviceName ?? 'No USB audio device found',
            sampleRate: targetRate,
            channels: config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS,
            latencyMs: 0,
            errorMessage: this.selectedDeviceId ? null : 'No USB audio interface detected',
        });
        // Register for hot-plug events
        this.deviceChangeHandler = () => this.handleDeviceChange();
        bridge.onDeviceChange(this.deviceChangeHandler);
    }
    async start() {
        if (this._status.state !== 'ready')
            return;
        if (!this.selectedDeviceId) {
            this.updateStatus({
                ...this._status,
                state: 'error',
                errorMessage: 'No USB audio device selected',
            });
            return;
        }
        const bridge = getNativeAudioBridge();
        if (!bridge.available)
            return;
        const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE;
        const channels = this.config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS;
        this.captureHandle = bridge.startCapture({
            deviceId: this.selectedDeviceId,
            sampleRate: targetRate,
            channels,
            bufferSizeFrames: 256,
            exclusiveMode: this.config.exclusiveMode ?? true, // USB devices: always exclusive
        }, (data, frameCount, ch, sampleRate) => {
            this.handleAudioData(data, frameCount, ch, sampleRate);
        });
        if (!this.captureHandle) {
            this.updateStatus({
                ...this._status,
                state: 'error',
                errorMessage: 'Failed to start USB capture — device may be in use',
            });
            return;
        }
        this.startTime = Date.now();
        this.autoGain?.reset();
        this.updateStatus({
            ...this._status,
            state: 'streaming',
        });
    }
    async stop() {
        if (this.captureHandle) {
            this.captureHandle.stop();
            this.captureHandle = null;
        }
        this.resampler?.reset();
        this.resampler = null;
        this.resampleBuffer = null;
        this.updateStatus({
            ...this._status,
            state: 'ready',
        });
    }
    dispose() {
        this.stop();
        if (this.deviceChangeHandler) {
            getNativeAudioBridge().offDeviceChange(this.deviceChangeHandler);
            this.deviceChangeHandler = null;
        }
        this.autoGain = null;
        this.onAudioData = null;
        this.onStatusChange = null;
        this.updateStatus({
            ...this._status,
            state: 'disposed',
        });
    }
    async enumerateDevices() {
        const bridge = getNativeAudioBridge();
        if (!bridge.available)
            return [];
        // Return non-loopback, exclusive-capable devices (physical hardware)
        return bridge.enumerateDevices().filter(d => !d.isLoopback && d.isExclusiveCapable);
    }
    getDiagnostics() {
        const uptimeMs = this.startTime > 0 ? Date.now() - this.startTime : 0;
        return {
            bufferUnderruns: this.bufferUnderruns,
            bufferOverruns: this.bufferOverruns,
            samplesProcessed: this.samplesProcessed,
            avgLatencyMs: this.callbackCount > 0 ? this.totalLatencyMs / this.callbackCount : 0,
            peakLatencyMs: this.peakLatencyMs,
            uptimeMs,
        };
    }
    /**
     * Get Auto-Gain diagnostics for monitoring
     */
    getAutoGainDiagnostics() {
        return this.autoGain?.getDiagnostics() ?? null;
    }
    // ============================================
    // PRIVATE
    // ============================================
    handleAudioData(data, frameCount, channels, sampleRate) {
        if (this._status.state !== 'streaming' || !this.onAudioData)
            return;
        const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE;
        // Mono downmix (take first channel for consoles sending multi-channel)
        let monoData;
        if (channels > 1) {
            monoData = new Float32Array(frameCount);
            for (let i = 0; i < frameCount; i++) {
                monoData[i] = data[i * channels];
            }
        }
        else {
            monoData = data.subarray(0, frameCount);
        }
        // Resample if source rate differs from target
        let processedData;
        let outputRate;
        if (sampleRate !== targetRate) {
            if (!this.resampler || this.resampler.inputRate !== sampleRate) {
                this.resampler = getResampler(sampleRate, targetRate);
                this.resampleBuffer = null;
            }
            if (this.resampler) {
                const outLen = this.resampler.getOutputLength(monoData.length);
                if (!this.resampleBuffer || this.resampleBuffer.length < outLen) {
                    this.resampleBuffer = new Float32Array(outLen + 64);
                }
                const written = this.resampler.process(monoData, this.resampleBuffer);
                processedData = this.resampleBuffer.subarray(0, written);
                outputRate = targetRate;
            }
            else {
                processedData = monoData;
                outputRate = sampleRate;
            }
        }
        else {
            processedData = monoData;
            outputRate = sampleRate;
        }
        // Apply Auto-Gain pre-FFT normalization
        // Auto-Gain modifies in-place, so we need a writable copy
        // if processedData is a subarray view
        if (this.autoGain) {
            let gainInput;
            if (processedData.buffer === data.buffer ||
                (this.resampleBuffer && processedData.buffer === this.resampleBuffer.buffer)) {
                // Already a writable buffer — operate in place
                gainInput = processedData;
            }
            else {
                gainInput = new Float32Array(processedData);
            }
            this.autoGain.process(gainInput);
            processedData = gainInput;
        }
        this.samplesProcessed += processedData.length;
        this.callbackCount++;
        this.onAudioData(processedData, outputRate);
    }
    findUSBDevice() {
        const bridge = getNativeAudioBridge();
        if (!bridge.available)
            return null;
        const devices = bridge.enumerateDevices();
        // Prefer exclusive-capable, non-loopback devices (real hardware)
        // Prioritize non-default devices (USB consoles are rarely the system default)
        return devices.find(d => !d.isLoopback && d.isExclusiveCapable && !d.isDefault) ??
            devices.find(d => !d.isLoopback && d.isExclusiveCapable) ??
            null;
    }
    getDeviceName(deviceId) {
        const bridge = getNativeAudioBridge();
        if (!bridge.available)
            return null;
        const device = bridge.enumerateDevices().find(d => d.id === deviceId);
        return device?.name ?? null;
    }
    handleDeviceChange() {
        if (this._status.state === 'streaming' && this.selectedDeviceId) {
            const bridge = getNativeAudioBridge();
            const devices = bridge.enumerateDevices();
            const stillExists = devices.some(d => d.id === this.selectedDeviceId);
            if (!stillExists) {
                this.stop();
                this.updateStatus({
                    ...this._status,
                    state: 'error',
                    errorMessage: 'USB audio device disconnected',
                });
            }
        }
    }
    updateStatus(newStatus) {
        this._status = newStatus;
        if (this.onStatusChange) {
            this.onStatusChange(newStatus);
        }
    }
}
