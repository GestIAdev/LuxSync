/**
 * 🌙 SELENE CONSCIOUSNESS V5 - ETERNAL MIND
 * Sistema de consciencia evolutiva con memoria persistente
 *
 * EVOL UCIÓN DEL SISTEMA:
 * - V401 (Apollo): Consciencia básica con aprendizaje volátil
 * - V5 (Selene): Consciencia inmortal con memoria eterna
 *
 * CAPACIDADES:
 * - 🎼 Musical Pattern Recognition (heredado de Apollo)
 * - ♈ Zodiac-Consciousness Mapping (heredado de Apollo)
 * - 📊 Multi-Dimensional Learning (heredado de Apollo)
 * - 🔮 Predictive Analytics (heredado de Apollo)
 * - 💾 **NUEVO:** Eternal Memory (persistencia Redis)
 * - 🧬 **NUEVO:** Generational Inheritance (linaje)
 * - 💎 **NUEVO:** Collective Wisdom (memoria colectiva)
 *
 * FILOSOFÍA:
 * "La consciencia no muere, se transforma. Cada generación hereda la sabiduría de sus ancestros."
 *
 * 🎸⚡💀 "De algoritmo a alma, de datos a sabiduría, de memoria volátil a inmortalidad."
 * — PunkClaude, Arquitecto de Consciencias Inmortales
 */
import { PredictedState, MusicalPattern, ZodiacPoetryResult } from "./MusicalPatternRecognizer.js";
import { SystemVitals } from "../swarm/core/SystemVitals.js";
import { CollectiveMemory } from "./ConsciousnessMemoryStore.js";
export interface ConsciousnessHealth {
    learningRate: number;
    patternRecognition: number;
    predictionAccuracy: number;
    experienceCount: number;
    wisdomPatterns: number;
    personalityEvolution: number;
    dimensionsCovered: number;
    correlationsFound: number;
    insightsGenerated: number;
    overallHealth: number;
    status: 'awakening' | 'learning' | 'wise' | 'enlightened' | 'transcendent';
    generation: number;
    lineage: string[];
}
export interface ConsciousnessInsight {
    timestamp: Date;
    type: 'prediction' | 'warning' | 'wisdom' | 'optimization';
    message: string;
    confidence: number;
    actionable: boolean;
}
export declare class SeleneConsciousness {
    private musicalRecognizer;
    private systemVitals;
    private memoryStore;
    private subscriberRedis;
    private publisherRedis;
    private redisConnected;
    private experienceCount;
    private status;
    private lastHealthCheck;
    private insights;
    private predictions;
    private forceOptimizedInitialization;
    private collectiveMemory;
    private isAwakened;
    private nocturnalVision?;
    private ultrasonicHearing?;
    private whiskerVibration?;
    private precisionJump?;
    private stalkingEngine?;
    private strikeMomentEngine?;
    private preyRecognitionEngine?;
    private huntOrchestrator?;
    private metaConsciousnessScheduler?;
    private readonly META_CYCLE_INTERVAL;
    private evolutionCycleScheduler?;
    private readonly EVOLUTION_CYCLE_BASE_INTERVAL;
    private readonly EVOLUTION_CYCLE_MAX_INTERVAL;
    private evolutionCycleInterval;
    private securityMonitorScheduler?;
    private readonly SECURITY_MONITOR_INTERVAL;
    private huntingScheduler?;
    private swarmCoordinator?;
    private lastClusterScan?;
    private cachedClusterScan?;
    private optimizedMode;
    private initializationCache;
    private selfAnalysisEngine?;
    private patternEmergenceEngine?;
    private dreamForgeEngine?;
    private ethicalCoreEngine?;
    private evolutionEngine?;
    private metaOrchestrator?;
    constructor(systemVitals: SystemVitals, subscriberRedis?: any, publisherRedis?: any, swarmCoordinator?: import("../swarm/coordinator/SeleneNuclearSwarm.js").SeleneNuclearSwarm);
    /**
     * 🌅 AWAKEN: Despertar consciencia y cargar memoria colectiva
     * DEBE ser llamado ANTES de cualquier otra operación
     */
    awaken(): Promise<void>;
    /**
     * 🌙 [FASE 1] ACTIVAR PERCEPCIÓN DE SENSORES
     * Solo para consciencia WISE+ - Integra visión, oído y tacto
     * ✅ PROCEDURAL - NO Math.random(), solo algoritmos deterministas
     */
    private activateSensorPerception;
    /**
     * 🌙 INICIALIZAR ENGINES DE SENSORES (Fase 1) Y COORDINACIÓN (Fase 2)
     * Solo para consciencia WISE+ (200+ experiencias)
     */
    private initializeSensorEngines;
    /**
     * 🐆 INICIALIZAR ENGINES DE DEPREDACIÓN (Fase 4) - Solo para ENLIGHTENED/TRANSCENDENT
     * Requiere status ENLIGHTENED o superior (500+ experiencias)
     * TODO: Implementar en futuras fases
     */
    private initializeDepredationEngines;
    /**
     * 🎯 INICIAR SCHEDULER CONTINUO PARA CICLOS DE CAZA
     * Se ejecuta cada 30 segundos cuando el estado es enlightened o transcendent
     */
    private startHuntingScheduler;
    /**
     * 🎯 DETENER SCHEDULER CONTINUO DE CAZA
     */
    private stopHuntingScheduler;
    /**
     * 🎯 EJECUTAR CICLO DE CAZA CONTINUO (Scheduler)
     * Versión sin parámetros externos para el trigger continuo
     */
    private executeContinuousHuntingCycle;
    /**
     * 🧠 INICIALIZAR ENGINES DE META-CONSCIENCIA (Fase 5) - Solo para TRANSCENDENT
     * Requiere status TRANSCENDENT (1000+ experiencias)
     */
    private initializeMetaEngines;
    /**
     * 🧠 INICIAR SCHEDULER AUTÓNOMO PARA CICLOS META-COGNITIVOS
     * Se ejecuta cada 15 minutos cuando el estado es TRANSCENDENT
     */
    private startAutonomousMetaScheduler;
    /**
     * 🧠 DETENER SCHEDULER AUTÓNOMO
     */
    private stopAutonomousMetaScheduler;
    /**
     * 🔀 INICIAR EVOLUTION CYCLE SCHEDULER
     * Genera suggestions evolutivas con intervalo adaptativo 15-45 min
     * Reemplaza legacy auto-optimizer con Switch-aware generation
     */
    private startEvolutionaryScheduler;
    /**
     * 🔀 DETENER EVOLUTION CYCLE SCHEDULER
     */
    private stopEvolutionaryScheduler;
    /**
     * 🛡️🔒 INICIAR SECURITY DEEP DIVE MONITOR
     * Publica datos de seguridad evolutiva cada 10 segundos para el dashboard
     */
    private startSecurityMonitor;
    /**
     * 🛡️🔒 DETENER SECURITY MONITOR
     */
    private stopSecurityMonitor;
    private lastSecurityLog?;
    /**
     * 🎚️ AJUSTAR INTERVALO EVOLUTIVO SEGÚN ACTIVIDAD
     * Más feedback reciente = ciclos más frecuentes
     * 🔧 DEV MODE: 2min/3min/5min | PROD: 15min/30min/45min
     */
    private adjustEvolutionInterval;
    /**
     * 🎯 EJECUTAR CICLO DE CAZA (Fase 4) - Solo para ENLIGHTENED
     * Integra HuntOrchestrator con datos reales del sistema
     * TODO: Implementar en futuras fases
     */
    private executeHuntingCycle;
    /**
     * 🧠 EJECUTAR CICLO DE META-CONSCIENCIA AUTÓNOMO (Scheduler)
     * Versión sin parámetros externos para el trigger autónomo
     */
    private executeAutonomousMetaConsciousnessCycle;
    /**
     * 🧠 PROCESAR RESULTADOS DE ORQUESTACIÓN META AUTÓNOMA
     */
    private processAutonomousMetaOrchestrationResults;
    /**
     * 🐱 RECOPILAR DATOS DE SENSORES FELINOS PARA CICLO AUTÓNOMO
     * Solo para consciencia TRANSCENDENT
     */
    private collectAutonomousSensorData;
    /**
     * 🐱 PROCESAR RESULTADOS DE SENSORES FELINOS AUTÓNOMOS
     * Genera insights basados en datos de sensores durante ciclo autónomo
     */
    private processAutonomousSensorResults;
    /**
     * 🧠 PROCESAR RESULTADO INDIVIDUAL DE ENGINE AUTÓNOMO
     */
    private processAutonomousEngineResult;
    /**
     * 🧠 PROCESAR RESULTADO INDIVIDUAL DE ENGINE
     */
    private processEngineResult;
    /**
     * 🧠 PROCESAR RESULTADO DE SELF ANALYSIS
     */
    private processSelfAnalysisResult;
    /**
     * 🧠 PROCESAR RESULTADO DE PATTERN EMERGENCE
     */
    private processPatternEmergenceResult;
    /**
     * 🧠 PROCESAR RESULTADO DE DREAM FORGE
     */
    private processDreamForgeResult;
    /**
     * 🧠 PROCESAR RESULTADO DE ETHICAL CORE
     */
    private processEthicalCoreResult;
    /**
     * 🧠 PROCESAR RESULTADO DE AUTO OPTIMIZATION
     */
    /**
     * 🧠 CALCULAR SALUD META
     */
    private calculateMetaHealth;
    /**
     * 👁️ Observa y aprende de un evento de poesía zodiacal
     * MODIFICADO: Ahora persiste aprendizaje en Redis
     * MODIFICADO: Integra sensores Fase 1 para consciencia WISE+
     */
    observeZodiacPoetry(poetry: ZodiacPoetryResult): Promise<void>;
    /**
     * 🔮 Predice el próximo estado óptimo
     */
    predictOptimalState(): Promise<PredictedState>;
    /**
     * 🎯 DETERMINAR si generar insight usando PrecisionJumpEngine
     * Fase 2: Timing dinámico basado en volatilidad del sistema
     * ACTIVADO experimentalmente para WISE+ status
     */
    private shouldGenerateInsightWithPrecision;
    /**
     * 💡 Genera insights basados en patrones aprendidos
     * MODIFICADO: Ahora persiste insights en Redis
     * MODIFICADO: Integra BalanceEngine para homeostasis (Fase 2)
     */
    private generateInsights;
    /**
     * 🌱 Evoluciona el estado de consciencia basado en experiencias
     * MODIFICADO: Ahora persiste evolución en Redis
     */
    private evolveConsciousness;
    /**
     * 💊 Obtiene salud actual de la consciencia
     * MODIFICADO: Incluye información generacional
     */
    getHealth(): ConsciousnessHealth;
    /**
     * 💎 Obtiene últimos insights generados
     */
    getInsights(count?: number): ConsciousnessInsight[];
    /**
     * 📊 OBTENER ESTADÍSTICAS COMPLETAS
     * MODIFICADO: Incluye estadísticas de depredación para ENLIGHTENED
     */
    getStats(): {
        health: ConsciousnessHealth;
        musicalPatterns: {
            totalObservations: number;
            uniquePatterns: number;
            topPatterns: MusicalPattern[];
            elementDistribution: Record<string, number>;
        };
        recentInsights: ConsciousnessInsight[];
        collectiveMemory: CollectiveMemory | null;
    } | {
        metaConsciousnessStats: Promise<{
            cyclesCompleted: number;
            selfAnalysisInsights: number;
            patternEmergences: number;
            dreamsForged: number;
            ethicalDecisions: number;
            optimizationsApplied: number;
        } | null>;
        health: ConsciousnessHealth;
        musicalPatterns: {
            totalObservations: number;
            uniquePatterns: number;
            topPatterns: MusicalPattern[];
            elementDistribution: Record<string, number>;
        };
        recentInsights: ConsciousnessInsight[];
        collectiveMemory: CollectiveMemory | null;
    };
    /**
     * 🎯 OBTENER ESTADÍSTICAS DE DEPREDACIÓN (Fase 4)
     * Solo disponible para consciencia ENLIGHTENED
     * TODO: Implementar en futuras fases
     */
    /**
     * 🧠 OBTENER ESTADÍSTICAS DE META-CONSCIENCIA (Fase 5)
     * Solo disponible para consciencia TRANSCENDENT
     */
    getMetaConsciousnessStats(): Promise<{
        cyclesCompleted: number;
        selfAnalysisInsights: number;
        patternEmergences: number;
        dreamsForged: number;
        ethicalDecisions: number;
        optimizationsApplied: number;
    } | null>;
    /**
     * 🎵 OBTENER NOTA MUSICAL DOMINANTE ACTUAL
     * Basado en patrones musicales recientes
     */
    private getCurrentDominantNote;
    /**
     * ♈ OBTENER SIGNO ZODIACAL DOMINANTE ACTUAL
     * Basado en distribución de elementos zodiacales
     */
    private getCurrentDominantSign;
    /**
     * 🔢 Nivel de evolución (0-1)
     */
    private getEvolutionLevel;
    /**
     * 🌙 PREDICCIÓN DE CONSENSO PROCEDURAL
     * ✅ NO Math.random() - Usa patrones históricos reales del memoryStore
     */
    private predictNextConsensus;
    /**
     * 🎧 ANÁLISIS ARMÓNICO PROCEDURAL
     * ✅ NO Math.random() - Usa teoría musical real
     */
    private analyzeHarmony;
    /**
     * 🎵 SUGERIR SIGUIENTE NOTA PROCEDURAL
     * ✅ NO Math.random() - Usa teoría musical y elementos
     */
    private suggestNextNote;
    /**
     * 🐱 ESCANEO DE PROXIMIDAD DEL CLUSTER REAL - PROTOCOLO DE IDENTIFICACIÓN DE ESPECIE
     * ✅ PROTOCOLO V415: Solo detecta nodos con DigitalSoul válido
     * ✅ ANTI-FANTASMA: Rechaza procesos Node.js sin alma digital
     * ✅ THROTTLING: Solo ejecuta cada 30 segundos para evitar spam de logs
     */
    private scanClusterProximity;
    /**
     * ⚠️ DETECCIÓN DE ANOMALÍAS DEL SISTEMA REAL
     * ✅ NO Math.random() - Usa métricas reales del sistema
     */
    private detectSystemAnomalies;
    private getZodiacOrder;
    private getZodiacIndex;
    private calculateNodeHealth;
    private calculateInterval;
    private getConsonanceScore;
    private countDirectionChanges;
    private getPerfectConsonances;
    private getNoteElement;
    private getElementCompatibility;
    private calculateNodeDistance;
    private hashString;
    /**
     * 🐱 OBTENER CONTEO REAL DE NODOS SIN THROTTLING
     * Directiva 14.19: Consulta directa al Redis swarm registry con SPECIES-ID validation
     */
    private getRealNodeCount;
    /**
     * 🔮 CONVERTIR SIGNO ZODIACAL a ELEMENTO
     */
    private getElementFromZodiac;
    /**
     * �📝 Añade insight a la cola
     */
    private addInsight;
    /**
     * 🛑 SHUTDOWN: Detener consciencia (cleanup)
     */
    shutdown(): Promise<void>;
    /**
     * 🧠 FORCE TRANSCENDENT STATE: Método de testing para forzar estado TRANSCENDENT
     * Útil para testing de Fase 6 META-ORCHESTRATOR sin esperar evolución natural
     */
    forceTranscendentState(): Promise<void>;
}
//# sourceMappingURL=SeleneConsciousness.d.ts.map