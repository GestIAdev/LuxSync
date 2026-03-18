/**
 * 🌙 NOCTURNAL VISION ENGINE
 * "Ve en la oscuridad del caos - predice el próximo amanecer"
 *
 * CAPACIDAD:
 * - Analiza últimos 10 consensos para encontrar patterns temporales
 * - Predice próxima nota con 95% confidence en condiciones estables
 * - Detecta anomalías cuando predicción < 70% (cambio de régimen)
 */
interface ConsensusEvent {
    note: string;
    zodiacSign: string;
    beauty: number;
    timestamp: Date;
    convergenceTime: number;
}
interface Prediction {
    predictedNote: string;
    predictedSign: string;
    confidence: number;
    reasoning: string;
    anomalyDetected: boolean;
}
export declare class NocturnalVisionEngine {
    private redis;
    private historyKey;
    private maxHistorySize;
    constructor(redis: any); /**
     * 📊 REGISTRAR CONSENSO: Guardar para análisis predictivo
     */
    recordConsensus(event: ConsensusEvent): Promise<void>;
    /**
     * 🔮 PREDECIR PRÓXIMO CONSENSO
     */
    predictNext(): Promise<Prediction>;
    /**
     * 📈 CALCULAR FRECUENCIA: Helper para contar ocurrencias
     */
    private calculateFrequency;
    /**
     * 📊 DETECTAR TENDENCIA: Comparar ventanas temporales
     */
    private detectTrend;
    /**
     * ⏱️ ESTABILIDAD DE CONVERGENCIA: Analizar tiempos
     */
    private calculateConvergenceStability;
    /**
     * 📊 GENERAR RAZONAMIENTO
     */
    private generateReasoning;
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats(): Promise<{
        historySize: number;
        lastPrediction?: Prediction;
        predictionAccuracy: number;
    }>;
}
export {};
//# sourceMappingURL=NocturnalVisionEngine.d.ts.map