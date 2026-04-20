// WAVE 3402: VIRTUAL WIRE PROVIDER
//
// IInputProvider for Virtual Audio Cable devices:
// - Windows: VB-Cable, Voicemeeter, Virtual Audio Cable
// - macOS: BlackHole, Soundflower, Loopback
// - Linux: JACK loopback ports
//
// Uses the native C++ addon (NativeAudioBridge) for exclusive-mode capture
// bypassing system DSP. Falls back gracefully when native addon unavailable.
//
// Audio pipeline:
//   Native Capture → Polyphase Resampler (if needed) → onAudioData → AudioMatrix
import { getNativeAudioBridge } from './NativeAudioBridge';
import { getResampler } from './PolyphaseResampler';
import { OMNI_CONSTANTS } from './OmniInputTypes';
export class VirtualWireProvider {
    constructor() {
        this.type = 'virtual-wire';
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
        console.log('[VirtualWire] initialize() — checking native bridge...');
        const bridge = getNativeAudioBridge();
        if (!bridge.available) {
            console.error(`[VirtualWire] ❌ Native bridge unavailable: ${bridge.loadError}`);
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
        // Auto-detect virtual wire device if no deviceId specified
        if (config.deviceId) {
            this.selectedDeviceId = config.deviceId;
            console.log(`[VirtualWire] Using explicitly configured deviceId: "${config.deviceId}"`);
        }
        else {
            // WAVE 3406 — Opcion B (loopback nativo): capturar el lado eRender del
            // cable virtual via AUDCLNT_STREAMFLAGS_LOOPBACK.
            //
            // "CABLE Input" (VB-Audio) es el endpoint de RENDER al que Chrome/Brave
            // envían el audio.  Abrirlo con isLoopback=true permite interceptar la
            // señal limpia antes del DAC sin depender del canal eCapture, que en
            // algunas configuraciones de Windows sufre colapsos de canal (1ch->2ch)
            // o bloqueos de privacidad que devuelven buffers vacíos.
            //
            // isLoopback=true en el enumerador garantiza que es eRender (WAVE 3405).
            // AUDCLNT_STREAMFLAGS_LOOPBACK se aplica en wasapi_capture.cpp cuando el
            // CaptureConfig lo indique — pendiente WAVE 3407.
            //
            // Prioridad:
            //   1. "CABLE Input" eRender con isLoopback=true  (VB-Cable render side)
            //   2. Cualquier eRender virtual con isLoopback=true y nombre conocido
            //   3. No encontrado → warn, usuario debe configurar explícitamente
            const isVirtualRenderLoopback = (d) => d.isLoopback && ['CABLE Input', 'VB-Cable', 'BlackHole', 'Voicemeeter', 'Virtual Audio'].some(n => d.name.includes(n));
            const virtualDevice = devices.find(d => d.isLoopback && d.name.includes('CABLE Input')) ??
                devices.find(d => isVirtualRenderLoopback(d)) ??
                null;
            if (virtualDevice) {
                this.selectedDeviceId = virtualDevice.id;
                console.log(`[VirtualWire] Auto-detected virtual capture device: "${virtualDevice.name}" (${virtualDevice.id}) — isLoopback=${virtualDevice.isLoopback}`);
            }
            else {
                console.warn('[VirtualWire] ⚠️  No virtual loopback device auto-detected. VB-Cable "CABLE Input" not found in enumeration.');
            }
        }
        const deviceName = this.selectedDeviceId
            ? (devices.find(d => d.id === this.selectedDeviceId)?.name ?? null)
            : null;
        this.updateStatus({
            state: 'ready',
            deviceName: deviceName ?? 'No virtual wire device found',
            sampleRate: config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
            channels: config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS,
            latencyMs: 0,
            errorMessage: this.selectedDeviceId ? null : 'No VB-Cable/BlackHole detected',
        });
        if (this.selectedDeviceId) {
            console.log(`[VirtualWire] ✅ Initialized — device: "${deviceName}" ready, waiting for start()`);
        }
        else {
            console.warn('[VirtualWire] ⚠️  Initialized with NO device — start() will fail until a loopback device is available');
        }
        // Register for hot-plug events
        this.deviceChangeHandler = () => this.handleDeviceChange();
        bridge.onDeviceChange(this.deviceChangeHandler);
    }
    async start() {
        console.log(`[VirtualWire] start() — current state: "${this._status.state}"`);
        if (this._status.state !== 'ready') {
            console.warn(`[VirtualWire] start() aborted — state is "${this._status.state}", expected "ready"`);
            return;
        }
        if (!this.selectedDeviceId) {
            console.error('[VirtualWire] ❌ start() aborted — no device selected');
            this.updateStatus({
                ...this._status,
                state: 'error',
                errorMessage: 'No virtual wire device selected',
            });
            return;
        }
        const bridge = getNativeAudioBridge();
        if (!bridge.available) {
            console.error('[VirtualWire] ❌ start() aborted — native bridge not available');
            return;
        }
        const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE;
        // WAVE 3406: if the selected device is an eRender loopback endpoint
        // (isLoopback=true, e.g. "CABLE Input"), tell the native capture to open
        // it with AUDCLNT_STREAMFLAGS_LOOPBACK. Exclusive mode is incompatible
        // with loopback and is forced off in that case.
        const devices = getNativeAudioBridge().enumerateDevices();
        const selectedDevice = devices.find(d => d.id === this.selectedDeviceId);
        const isLoopbackDevice = selectedDevice?.isLoopback ?? false;
        // WAVE 3411: Para dispositivos loopback siempre solicitamos 2 canales.
        //
        // DEFAULT_CHANNELS = 1. WASAPI en modo loopback sobre VB-Cable (stereo)
        // con channels=1 hace el downmix internamente tomando solo el canal L
        // (comportamiento idéntico al bug original del downmix). handleAudioData
        // nunca llega al bloque if(_channels > 1) — no hay samples que mezclar.
        //
        // Fix: forzar 2ch para loopback. WASAPI entrega el par interleaved L,R.
        // handleAudioData hace el sum-to-mono correcto (L+R)/2 desde la señal completa.
        // Para mic/non-loopback mantenemos el channelSelection del config (puede ser 1ch).
        const channels = isLoopbackDevice ? 2 : (this.config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS);
        console.log(`[VirtualWire] Starting native capture — device: "${this.selectedDeviceId}" | ${channels}ch @ ${targetRate}Hz | exclusive: ${!isLoopbackDevice && (this.config.exclusiveMode ?? true)} | loopback: ${isLoopbackDevice}`);
        this.captureHandle = bridge.startCapture({
            deviceId: this.selectedDeviceId,
            sampleRate: targetRate,
            channels,
            bufferSizeFrames: 256,
            exclusiveMode: !isLoopbackDevice && (this.config.exclusiveMode ?? true),
            loopbackMode: isLoopbackDevice,
        }, (data, frameCount, ch, sampleRate) => {
            this.handleAudioData(data, frameCount, ch, sampleRate);
        });
        if (!this.captureHandle) {
            console.error('[VirtualWire] ❌ captureHandle is null after startCapture — native addon rejected the config');
            this.updateStatus({
                ...this._status,
                state: 'error',
                errorMessage: 'Failed to start native capture',
            });
            return;
        }
        this.startTime = Date.now();
        console.log(`[VirtualWire] ✅ Capture streaming — handle: ${this.captureHandle.id}`);
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
        // Remove device change listener
        if (this.deviceChangeHandler) {
            getNativeAudioBridge().offDeviceChange(this.deviceChangeHandler);
            this.deviceChangeHandler = null;
        }
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
        return bridge.enumerateDevices().filter(d => d.isLoopback);
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
    // ============================================
    // PRIVATE
    // ============================================
    handleAudioData(data, frameCount, _channels, sampleRate) {
        if (this._status.state !== 'streaming' || !this.onAudioData)
            return;
        const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE;
        // WAVE 3410 ANOMALÍA 2: DOWNMIX CORRECTO (suma y promedio, no selección de canal)
        //
        // El downmix anterior tomaba data[i * _channels] (solo canal L).
        // Para señales stereo esto descarta el 50% de la energía espectral.
        // En techno con kick centrado pero procesado por canal, el canal L
        // puede tener hasta -6dB respecto al sum-to-mono correcto, aplastando
        // el rawBassEnergy que alimenta el IntervalBPMTracker.
        //
        // FIX: suma todos los canales disponibles y promedía → rango -1.0 a +1.0
        // conservado, ganancia de suma cuadrada evitada.
        let monoData;
        if (_channels > 1) {
            monoData = new Float32Array(frameCount);
            const invChannels = 1.0 / _channels;
            for (let i = 0; i < frameCount; i++) {
                let sum = 0;
                for (let c = 0; c < _channels; c++) {
                    sum += data[i * _channels + c];
                }
                monoData[i] = sum * invChannels;
            }
        }
        else {
            monoData = data.subarray(0, frameCount);
        }
        // WAVE 3411: Normalización de pico ELIMINADA (Fix B de WAVE 3410 revertido).
        // La amplificación artificial destruye la relación pico/media que el
        // IntervalBPMTracker necesita para operar: ratio = rawBassEnergy / rollingAvg.
        // Si se normaliza el pico, tanto el pico como la media suben proporcionalmente
        // y el ratio no cambia — PERO el rango dinámico (distancia pico-a-valle) se
        // colapsa contra el techo, aplastando la detección de transients.
        // La señal llega CRUDA al SAB; el AGC del Worker (senses.ts) es la única
        // capa de ganancia autorizada (WAVE 2162).
        // Resample if source rate differs from target
        let outputData;
        let outputRate;
        if (sampleRate !== targetRate) {
            // Lazy-init resampler (only when rate actually differs)
            if (!this.resampler || this.resampler.inputRate !== sampleRate) {
                this.resampler = getResampler(sampleRate, targetRate);
                this.resampleBuffer = null;
            }
            if (this.resampler) {
                const outLen = this.resampler.getOutputLength(monoData.length);
                if (!this.resampleBuffer || this.resampleBuffer.length < outLen) {
                    this.resampleBuffer = new Float32Array(outLen + 64); // +64 safety margin
                }
                const written = this.resampler.process(monoData, this.resampleBuffer);
                outputData = this.resampleBuffer.subarray(0, written);
                outputRate = targetRate;
            }
            else {
                outputData = monoData;
                outputRate = sampleRate;
            }
        }
        else {
            outputData = monoData;
            outputRate = sampleRate;
        }
        this.samplesProcessed += outputData.length;
        this.callbackCount++;
        this.onAudioData(outputData, outputRate);
    }
    findLoopbackDevice() {
        const bridge = getNativeAudioBridge();
        if (!bridge.available)
            return null;
        const devices = bridge.enumerateDevices();
        // Prefer VB-Cable/BlackHole, then any loopback
        return devices.find(d => d.isLoopback && d.isDefault) ??
            devices.find(d => d.isLoopback) ??
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
        // Re-check if our selected device is still available
        if (this._status.state === 'streaming' && this.selectedDeviceId) {
            const bridge = getNativeAudioBridge();
            const devices = bridge.enumerateDevices();
            const stillExists = devices.some(d => d.id === this.selectedDeviceId);
            if (!stillExists) {
                // Device unplugged — stop and report error
                this.stop();
                this.updateStatus({
                    ...this._status,
                    state: 'error',
                    errorMessage: 'Virtual wire device disconnected',
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
