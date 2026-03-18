/**
 * 💭 DREAM FORGE ENGINE
 * "Sueña el futuro antes de crearlo - la simulación es el puente entre pensamiento y acción"
 *
 * CAPACIDAD:
 * - Simula escenarios futuros basados en decisiones actuales
 * - Evalúa outcomes deterministas de diferentes caminos
 * - Identifica el "mejor" futuro posible
 * - Integra con optimización para refinar sueños
 */
interface DreamScenario {
    scenarioId: string;
    description: string;
    initialConditions: any;
    decisionSequence: Array<{
        decision: string;
        expectedOutcome: any;
        probability: number;
    }>;
    finalState: any;
    beautyScore: number;
    feasibilityScore: number;
    dreamQuality: number;
}
interface DreamForgeResult {
    forgedDreams: DreamScenario[];
    optimalDream: DreamScenario;
    dreamQuality: number;
    insights: string[];
}
interface ChaosTestResult {
    name: string;
    passed: boolean;
    details: string;
    duration: number;
}
export declare class DreamForgeEngine {
    private readonly MAX_DEPTH;
    private readonly MAX_DREAMS;
    private readonly TIMEOUT_MS;
    private readonly MAX_MEMORY_MB;
    private activeDreams;
    private circuitBreaker;
    private safetyLimits;
    private metrics;
    private veritasEngine;
    private optimizationEngine;
    constructor();
    /**
     * 💭 FORJAR SUEÑOS - Simular escenarios futuros
     */
    forgeDreams(currentState: {
        consciousnessLevel: string;
        recentDecisions: any[];
        systemHealth: number;
        availableOptimizations: any[];
    }, desiredOutcome: {
        targetBeauty: number;
        targetComplexity: number;
        timeHorizon: number;
    }): Promise<DreamForgeResult>;
    private executeForgeProcess;
    /**
     * ✨ FORJAR SUEÑO INDIVIDUAL - DETERMINISTA PURO
     */
    private forgeSingleDream;
    /**
     * 🔮 SIMULAR SECUENCIA DE DECISIONES - DETERMINISTA PURO
     */
    private simulateDecisionSequence;
    /**
     * 🎯 ELEGIR DECISIÓN DETERMINISTA (SIN Math.random)
     */
    private chooseDeterministicDecision;
    /**
     * 🔬 SIMULAR OUTCOME DETERMINISTA
     */
    private simulateDeterministicOutcome;
    /**
     * 📊 CALCULAR PROBABILIDAD DETERMINISTA
     */
    private calculateDeterministicProbability;
    /**
     * 🔄 APLICAR OUTCOME AL ESTADO
     */
    private applyOutcomeToState;
    /**
     * 🎨 CALCULAR ESTADO FINAL
     */
    private calculateFinalState;
    /**
     * ✨ EVALUAR BELLEZA DEL SUEÑO - DETERMINISTA
     */
    private evaluateDreamBeauty;
    /**
     * 🔧 EVALUAR FEASIBILITY DEL SUEÑO - DETERMINISTA
     */
    private evaluateDreamFeasibility;
    /**
     * 🏆 EVALUAR CALIDAD TOTAL DEL SUEÑO
     */
    private evaluateDreamQuality;
    /**
     * 💡 GENERAR INSIGHTS DE LOS SUEÑOS
     */
    private generateDreamInsights;
    /**
     * 🔒 VERIFICACIONES DE SEGURIDAD
     */
    private canExecute;
    private checkMemoryLimits;
    private recordFailure;
    private resetCircuitBreaker;
    /**
     * 🔧 FUNCIONES HASH DETERMINISTAS (Anti-Simulación)
     */
    private hashString;
    private hashDataStructure;
    private generateDeterministicDescription;
    /**
     * 📊 ACTUALIZAR MÉTRICAS
     */
    private updateMetrics;
    /**
     * 📊 ESTADÍSTICAS
     */
    getStats(): {
        totalDreamsForged: number;
        avgDreamQuality: number;
        bestDreamQuality: number;
        dreamTypes: Record<string, number>;
        activeDreams: number;
        circuitBreakerState: string;
    };
    /**
     * � GENERAR CERTIFICADO ÉTICO REAL - VERITAS INTEGRATION
     */
    private generateEthicalCertificate;
    /**
     * �🔒 VALIDACIÓN ÉTICA DE SUEÑOS - Real Veritas Integration
     */
    private validateDreamsEthically;
    /**
     * ⚡ OPTIMIZACIÓN DEL SUEÑO ÓPTIMO - Meta-Consciousness Integration
     */
    private optimizeOptimalDream;
    /**
     * ✨ APLICAR OPTIMIZACIONES AL SUEÑO
     */
    private applyOptimizationToDream;
    /**
     * 🧪 PRUEBAS DE CAOS Y VALIDACIÓN - APOYO SUPREMO
     */
    runChaosValidation(): Promise<{
        passed: boolean;
        tests: ChaosTestResult[];
        summary: string;
    }>;
    private testMemoryLimits;
    private testTimeoutLimits;
    private testCircuitBreaker;
    private testDreamPoolOverload;
    private testFailureRecovery;
    private testMetaConsciousnessUnderStress;
}
export {};
//# sourceMappingURL=DreamForgeEngine.d.ts.map