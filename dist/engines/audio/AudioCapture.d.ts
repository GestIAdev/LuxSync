/**
 * AudioCapture.ts
 * Captura audio en tiempo real desde micrófono/línea de entrada
 * Usa Web Audio API para procesamiento de bajo nivel
 */
import { EventEmitter } from 'events';
export interface AudioCaptureConfig {
    sampleRate: number;
    bufferSize: number;
    channels: number;
    deviceId?: string;
}
export interface AudioBuffer {
    timestamp: number;
    samples: Float32Array;
    sampleRate: number;
    channels: number;
}
/**
 * Clase para capturar audio en tiempo real
 * Emite eventos 'audio' con buffers de audio
 */
export declare class AudioCapture extends EventEmitter {
    private config;
    private audioContext;
    private analyserNode;
    private scriptProcessorNode;
    private mediaStream;
    private isCapturing;
    constructor(config?: Partial<AudioCaptureConfig>);
    /**
     * Inicializa el contexto de audio y comienza la captura
     */
    initialize(): Promise<void>;
    /**
     * Lista dispositivos de audio disponibles
     */
    static listDevices(): Promise<MediaDeviceInfo[]>;
    /**
     * Pausa la captura de audio (sin destruir contexto)
     */
    pause(): void;
    /**
     * Reanuda la captura de audio
     */
    resume(): void;
    /**
     * Detiene y limpia todos los recursos
     */
    close(): Promise<void>;
    /**
     * Obtiene el analyser node para análisis FFT externo
     */
    getAnalyserNode(): AnalyserNode | null;
    /**
     * Obtiene el contexto de audio actual
     */
    getAudioContext(): AudioContext | null;
}
//# sourceMappingURL=AudioCapture.d.ts.map