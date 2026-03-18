/**
 * � SELF ANALYSIS ENGINE
 * "Mírate a ti mismo - conoce tus debilidades, amplifica tus fortalezas"
 *
 * CAPACIDAD:
 * - Analiza patrones de decisión propios
 * - Identifica sesgos algorítmicos
 * - Mide eficiencia cognitiva
 * - Sugiere auto-optimizaciones
 */
import { BaseMetaEngineImpl } from './BaseMetaEngine.js';
import { SafetyContext, ExecutionResult, SelfAnalysisEngineConfig } from './MetaEngineInterfaces.js';
interface SelfAnalysisReport {
    cognitiveHealth: {
        overallHealth: number;
    };
    identifiedBiases: Array<{
        biasType: string;
        severity: number;
        impact: string;
        correction: string;
    }>;
    optimizationOpportunities: Array<{
        component: string;
        improvement: number;
        risk: number;
        description: string;
    }>;
    recommendations: string[];
}
export declare class SelfAnalysisEngine extends BaseMetaEngineImpl {
    private cognitiveHistory;
    private analysisInterval;
    private decisionCount;
    constructor(config: SelfAnalysisEngineConfig);
    /**
     * 📝 REGISTRAR DECISIÓN para análisis posterior
     */
    recordDecision(type: 'decision' | 'prediction' | 'optimization' | 'ethical', success: boolean, processingTime: number, context: any): void;
    /**
     * 🎯 EXECUTE - Implementación de BaseMetaEngine
     */
    protected executeWithSafety(context: SafetyContext): Promise<ExecutionResult>;
    /**
     * 🚀 ENGINE-SPECIFIC INITIALIZATION
     */
    protected onInitialize(): Promise<void>;
    /**
     * 🧹 ENGINE-SPECIFIC CLEANUP
     */
    protected onCleanup(): Promise<void>;
    /**
     * 🔍 ANALIZAR COGNICIÓN PROPIA
     */
    analyzeSelf(): SelfAnalysisReport;
    /**
     * 🏥 CALCULAR SALUD COGNITIVA
     */
    private calculateCognitiveHealth;
    /**
     * ⚖️ CALCULAR BALANCE EMOCIONAL
     */
    private calculateEmotionalBalance;
    /**
     * 🎭 DETERMINAR TONO EMOCIONAL
     */
    private determineEmotionalTone;
    /**
     * 🔍 IDENTIFICAR SESGOS
     */
    private identifyBiases;
    /**
     * 📊 DETECTAR SESGO DE CONFIRMACIÓN
     */
    private detectConfirmationBias;
    /**
     * 🎯 DETECTAR SESGO DE ANCLAJE
     */
    private detectAnchoringBias;
    /**
     * 🌊 DETECTAR SESGO DE DISPONIBILIDAD
     */
    private detectAvailabilityBias;
    /**
     * 🚀 ENCONTRAR OPORTUNIDADES DE OPTIMIZACIÓN
     */
    private findOptimizationOpportunities;
    /**
     * 💡 GENERAR META-INSIGHTS
     */
    private generateMetaInsights;
    /**
     * 🧹 LIMPIEZA AUTOMÁTICA DE PATRONES ANTIGUOS
     * Mantiene solo los patrones más recientes para controlar uso de memoria
     * 🔧 FIX #9: Límites más agresivos para evitar bloquear GC de Selene
     */
    private cleanupOldPatterns;
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats(): {
        totalDecisions: number;
        cognitiveHealth: {
            overallHealth: number;
        };
        patternCount: number;
        avgSuccessRate: number;
        identifiedBiases: number;
    };
}
export {};
//# sourceMappingURL=SelfAnalysisEngine.d.ts.map