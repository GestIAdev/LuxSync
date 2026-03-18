/**
 * BeatDetector.ts
 * Detecta beats usando onset detection con análisis de energía espectral
 * Algoritmo basado en cambios súbitos de energía en bandas de frecuencia
 */
export interface BeatDetectionConfig {
    threshold: number;
    minBeatInterval: number;
    energyWindowSize: number;
    adaptiveThreshold: boolean;
}
export interface BeatEvent {
    timestamp: number;
    strength: number;
    confidence: number;
    bpm?: number;
}
/**
 * Detector de beats en tiempo real
 * Usa análisis de energía espectral con ventana deslizante
 */
export declare class BeatDetector {
    private config;
    private energyHistory;
    private lastBeatTime;
    private beatIntervals;
    private currentBPM;
    constructor(config?: Partial<BeatDetectionConfig>);
    /**
     * Procesa un buffer de audio y detecta beats
     * @param samples Array de muestras de audio [-1, 1]
     * @param timestamp Timestamp del buffer
     * @returns BeatEvent si se detectó beat, null si no
     */
    detect(samples: Float32Array, timestamp: number): BeatEvent | null;
    /**
     * Calcula la energía de un buffer de audio
     * E = sum(sample^2) / length
     */
    private calculateEnergy;
    /**
     * Calcula el promedio de un array
     */
    private calculateAverage;
    /**
     * Calcula la varianza de un array
     */
    private calculateVariance;
    /**
     * Actualiza el BPM basado en intervalos entre beats
     */
    private updateBPM;
    /**
     * Obtiene el BPM actual estimado
     */
    getBPM(): number;
    /**
     * Ajusta la sensibilidad del detector
     * @param threshold Nuevo threshold (0.1 - 1.0)
     */
    setThreshold(threshold: number): void;
    /**
     * Reinicia el estado del detector
     */
    reset(): void;
    /**
     * Obtiene estadísticas del detector
     */
    getStats(): {
        bpm: number;
        avgEnergy: number;
        threshold: number;
        beatCount: number;
    };
}
//# sourceMappingURL=BeatDetector.d.ts.map