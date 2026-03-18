import { EvolutionarySuggestion, FeedbackEntry } from './interfaces/evolutionary-engine-interfaces.js';
/**
 * 🌟 SELENE EVOLUTION ENGINE
 * El corazón evolutivo de Selene Song
 * Integra música, poesía, zodiaco y fibonacci en decisiones vivas
 */
export declare class SeleneEvolutionEngine {
    private systemVitals;
    private redis;
    private safetyValidator;
    private patternSanityChecker;
    private containmentSystem;
    private rollbackEngine;
    private sanityCheckEngine;
    private quarantineSystem;
    private anomalyDetector;
    constructor();
    private evolutionHistory;
    private feedbackHistory;
    private readonly MAX_HISTORY_SIZE;
    private readonly MAX_FEEDBACK_SIZE;
    private evolutionMutex;
    private readonly MUTEX_TIMEOUT;
    private readonly REDIS_HISTORY_KEY;
    private readonly REDIS_FEEDBACK_KEY;
    private readonly REDIS_TYPE_WEIGHTS_KEY;
    private readonly DEFAULT_WEIGHT;
    private readonly WEIGHT_INCREMENT;
    private readonly WEIGHT_DECREMENT;
    private readonly MIN_WEIGHT;
    private readonly MAX_WEIGHT;
    /**
     * Ciclo principal de evolución
     */
    executeEvolutionCycle(): Promise<EvolutionarySuggestion[]>;
    /**
     * Lógica interna del ciclo evolutivo
     */
    private performEvolutionCycle;
    /**
     * Construye contexto evolutivo completo
     */
    private buildEvolutionContext;
    /**
     * Obtiene patrones actuales desde Redis
     */
    private getCurrentPatterns;
    /**
     * Obtiene feedback reciente desde Redis
     */
    private getRecentFeedback;
    /**
     * Obtiene estado de conciencia de Selene
     */
    private getSeleneConsciousnessState;
    /**
     * Valida tipos de decisión con Veritas
     */
    private validateWithVeritas;
    /**
     * Convierte tipos evolutivos a sugerencias aplicables
     */
    private convertToSuggestions;
    /**
     * Calcula índice de novedad
     */
    private calculateNoveltyIndex;
    /**
     * Calcula similitud entre tipos
     */
    private calculateTypeSimilarity;
    /**
     * Determina componente objetivo basado en tipo evolutivo
     */
    private determineTargetComponent;
    /**
     * Agrega tipos al historial
     */
    private addToEvolutionHistory;
    /**
     * Registra feedback humano y ACTUALIZA PESOS EN REDIS
     */
    registerHumanFeedback(feedback: FeedbackEntry): Promise<void>;
    /**
     * Archiva datos en Redis
     */
    private archiveToRedis;
    /**
     * Aprende del feedback humano (LEGACY - ahora usa updateTypeWeights)
     */
    private learnFromFeedback;
    /**
     * 🔥 ACTUALIZA PESOS DE TIPOS EN REDIS BASÁNDOSE EN FEEDBACK
     */
    private updateTypeWeights;
    /**
     * 🔥 OBTIENE PESO DE UN TIPO DESDE REDIS
     */
    private getTypeWeight;
    /**
     * 🔥 OBTIENE TODOS LOS PESOS DE TIPOS DESDE REDIS
     */
    private getAllTypeWeights;
    /**
     * Obtiene estadísticas de evolución
     */
    getEvolutionStats(): any;
    /**
     * Optimiza memoria limpiando historiales antiguos
     */
    optimizeMemory(): void;
    /**
     * Verifica si hay evolución en progreso
     */
    isEvolutionInProgress(): boolean;
}
//# sourceMappingURL=selene-evolution-engine.d.ts.map