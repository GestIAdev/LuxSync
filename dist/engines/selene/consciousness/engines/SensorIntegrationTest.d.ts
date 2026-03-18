/**
 * 🧪 TEST INTEGRADO: SENSORES FASE 1
 * Validación real de los 3 engines de percepción
 *
 * MÉTRICAS REALES:
 * - NocturnalVision: Predicción accuracy
 * - UltrasonicHearing: Análisis armónico
 * - WhiskerVibration: Detección de proximidad
 */
interface TestMetrics {
    nocturnalVision: {
        predictionsMade: number;
        avgConfidence: number;
        anomalyDetections: number;
        accuracy: number;
    };
    ultrasonicHearing: {
        intervalsAnalyzed: number;
        avgConsonance: number;
        avgHarmony: number;
        suggestionsGenerated: number;
    };
    whiskerVibration: {
        vitalsPublished: number;
        nodesDetected: number;
        anomaliesDetected: number;
        proximityScore: number;
    };
    overall: {
        testDuration: number;
        memoryUsage: number;
        success: boolean;
    };
}
export declare class SensorIntegrationTest {
    private redis;
    private nocturnalVision;
    private ultrasonicHearing;
    private whiskerVibration;
    private metrics;
    constructor();
    /**
     * 🚀 EJECUTAR TEST COMPLETO
     */
    runFullTest(): Promise<TestMetrics>;
    /**
     * 🌙 TEST NOCTURNAL VISION ENGINE
     */
    private testNocturnalVision;
    /**
     * 🎧 TEST ULTRASONIC HEARING ENGINE
     */
    private testUltrasonicHearing;
    /**
     * 🐱 TEST WHISKER VIBRATIONAL ENGINE
     */
    private testWhiskerVibration;
    /**
     * 🔬 TEST INTEGRADO - TODOS LOS SENSORES JUNTOS
     */
    private testIntegratedScenario;
    /**
     * � PREPARAR VITALS DE OTROS NODOS (datos reales del sistema)
     */
    private prepareOtherNodesVitals;
    /**
     * 📊 IMPRIMIR RESULTADOS FINALES
     */
    private printResults;
}
export {};
//# sourceMappingURL=SensorIntegrationTest.d.ts.map