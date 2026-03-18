/**
 * FFTAnalyzer.ts
 * Análisis FFT en tiempo real para extraer bandas de frecuencia
 * Bass (20-250Hz), Mid (250-4kHz), Treble (4-20kHz)
 */
export interface FFTAnalyzerConfig {
    fftSize: number;
    smoothingTimeConstant: number;
    minDecibels: number;
    maxDecibels: number;
}
export interface FrequencyBands {
    bass: number;
    mid: number;
    treble: number;
    rms: number;
    spectrum: Float32Array;
}
/**
 * Analizador FFT para extracción de bandas de frecuencia
 */
export declare class FFTAnalyzer {
    private config;
    private analyserNode;
    private frequencyData;
    private timeData;
    private bassRange;
    private midRange;
    private trebleRange;
    constructor(analyserNode: AnalyserNode | null, config?: Partial<FFTAnalyzerConfig>);
    /**
     * Analiza el audio actual y retorna bandas de frecuencia
     */
    analyze(): FrequencyBands | null;
    /**
     * Calcula la energía promedio en un rango de bins
     */
    private calculateBandEnergy;
    /**
     * Calcula el RMS (Root Mean Square) global
     */
    private calculateRMS;
    /**
     * Actualiza el analyser node (útil si se recrea el contexto de audio)
     */
    setAnalyserNode(analyserNode: AnalyserNode): void;
    /**
     * Ajusta el suavizado temporal
     * @param value 0 (sin suavizado) a 1 (mucho suavizado)
     */
    setSmoothing(value: number): void;
    /**
     * Encuentra la frecuencia dominante en el espectro
     */
    findDominantFrequency(): {
        frequency: number;
        magnitude: number;
    };
    /**
     * Obtiene el espectro completo (para visualización o análisis)
     */
    getSpectrum(): Uint8Array;
    /**
     * Obtiene la forma de onda temporal (para visualización)
     */
    getWaveform(): Uint8Array;
}
//# sourceMappingURL=FFTAnalyzer.d.ts.map