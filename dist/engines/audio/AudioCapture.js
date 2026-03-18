/**
 * AudioCapture.ts
 * Captura audio en tiempo real desde micrófono/línea de entrada
 * Usa Web Audio API para procesamiento de bajo nivel
 */
import { EventEmitter } from 'events';
/**
 * Clase para capturar audio en tiempo real
 * Emite eventos 'audio' con buffers de audio
 */
export class AudioCapture extends EventEmitter {
    config;
    audioContext = null;
    analyserNode = null;
    scriptProcessorNode = null;
    mediaStream = null;
    isCapturing = false;
    constructor(config = {}) {
        super();
        this.config = {
            sampleRate: config.sampleRate || 44100,
            bufferSize: config.bufferSize || 2048,
            channels: config.channels || 1,
            deviceId: config.deviceId,
        };
    }
    /**
     * Inicializa el contexto de audio y comienza la captura
     */
    async initialize() {
        try {
            console.log('🎤 AudioCapture: Inicializando captura de audio...');
            // Crear contexto de audio
            // @ts-ignore - Web Audio API puede no estar tipado correctamente en Node.js
            const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('Web Audio API no disponible en este entorno');
            }
            this.audioContext = new AudioContextClass({
                sampleRate: this.config.sampleRate,
            });
            // Solicitar acceso al micrófono
            const constraints = {
                audio: {
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.channels,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    // @ts-ignore - deviceId puede no estar tipado
                    deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
                },
                video: false,
            };
            // @ts-ignore - navigator.mediaDevices puede no estar disponible en Node.js
            if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
                throw new Error('getUserMedia no disponible. Ejecutar en entorno con audio input.');
            }
            // @ts-ignore
            this.mediaStream = await globalThis.navigator.mediaDevices.getUserMedia(constraints);
            // Crear nodos de procesamiento
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = this.config.bufferSize * 2;
            this.analyserNode.smoothingTimeConstant = 0.3;
            this.scriptProcessorNode = this.audioContext.createScriptProcessor(this.config.bufferSize, this.config.channels, this.config.channels);
            // Conectar pipeline: source → analyser → scriptProcessor → destination
            source.connect(this.analyserNode);
            this.analyserNode.connect(this.scriptProcessorNode);
            this.scriptProcessorNode.connect(this.audioContext.destination);
            // Procesar audio en tiempo real
            this.scriptProcessorNode.onaudioprocess = (event) => {
                if (!this.isCapturing)
                    return;
                const inputBuffer = event.inputBuffer;
                const samples = inputBuffer.getChannelData(0); // Canal 0 (mono o left)
                const audioBuffer = {
                    timestamp: Date.now(),
                    samples: new Float32Array(samples), // Copiar para evitar mutación
                    sampleRate: inputBuffer.sampleRate,
                    channels: inputBuffer.numberOfChannels,
                };
                this.emit('audio', audioBuffer);
            };
            this.isCapturing = true;
            console.log(`✅ AudioCapture: Capturando audio (${this.config.sampleRate}Hz, buffer=${this.config.bufferSize})`);
        }
        catch (error) {
            console.error('❌ AudioCapture: Error al inicializar:', error);
            throw error;
        }
    }
    /**
     * Lista dispositivos de audio disponibles
     */
    static async listDevices() {
        try {
            // @ts-ignore
            if (!globalThis.navigator?.mediaDevices?.enumerateDevices) {
                throw new Error('enumerateDevices no disponible');
            }
            // @ts-ignore
            const devices = await globalThis.navigator.mediaDevices.enumerateDevices();
            return devices.filter((device) => device.kind === 'audioinput');
        }
        catch (error) {
            console.error('❌ AudioCapture: Error al listar dispositivos:', error);
            return [];
        }
    }
    /**
     * Pausa la captura de audio (sin destruir contexto)
     */
    pause() {
        this.isCapturing = false;
        console.log('⏸️  AudioCapture: Captura pausada');
    }
    /**
     * Reanuda la captura de audio
     */
    resume() {
        if (this.audioContext) {
            this.isCapturing = true;
            console.log('▶️  AudioCapture: Captura reanudada');
        }
    }
    /**
     * Detiene y limpia todos los recursos
     */
    async close() {
        this.isCapturing = false;
        if (this.scriptProcessorNode) {
            this.scriptProcessorNode.disconnect();
            this.scriptProcessorNode = null;
        }
        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        console.log('🛑 AudioCapture: Recursos liberados');
    }
    /**
     * Obtiene el analyser node para análisis FFT externo
     */
    getAnalyserNode() {
        return this.analyserNode;
    }
    /**
     * Obtiene el contexto de audio actual
     */
    getAudioContext() {
        return this.audioContext;
    }
}
//# sourceMappingURL=AudioCapture.js.map