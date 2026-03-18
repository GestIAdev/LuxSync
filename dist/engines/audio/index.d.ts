/**
 * 🎵 AUDIO ENGINE - INDEX
 *
 * Análisis de audio en tiempo real para LuxSync
 * Integra: AudioCapture + BeatDetector + FFTAnalyzer
 */
export interface AudioFrame {
    timestamp: number;
    bass: number;
    mid: number;
    treble: number;
    beat: boolean;
    beatStrength: number;
    bpm: number;
    bpmConfidence: number;
    rms: number;
    spectralCentroid?: number;
    spectralRolloff?: number;
    zcr?: number;
}
export declare class AudioEngine {
    private audioCapture;
    private beatDetector;
    private fftAnalyzer;
    private currentFrame;
    private isRunning;
    constructor();
    initialize(): Promise<void>;
    /**
     * Procesa cada buffer de audio entrante
     */
    private processAudioBuffer;
    /**
     * Obtiene el frame de audio más reciente
     */
    getFrame(): Promise<AudioFrame>;
    /**
     * Ajusta la sensibilidad del detector de beats
     */
    setBeatSensitivity(threshold: number): void;
    /**
     * Obtiene estadísticas del motor de audio
     */
    getStats(): {
        currentFrame: AudioFrame;
        bpm: number;
        avgEnergy: number;
        threshold: number;
        beatCount: number;
    };
    /**
     * Pausa el procesamiento de audio
     */
    pause(): void;
    /**
     * Reanuda el procesamiento de audio
     */
    resume(): void;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map