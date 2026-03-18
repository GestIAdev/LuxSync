/**
 * 🔄 EVOLUTIONARY ROLLBACK ENGINE
 * Rollback específico para decisiones evolutivas
 * "La evolución puede equivocarse, pero siempre puede volver atrás"
 */
import { EvolutionarySuggestion } from '../interfaces/evolutionary-engine-interfaces.js';
export interface RollbackResult {
    success: boolean;
    rolledBackComponents: string[];
    errors: string[];
    recoveryTime: number;
}
export declare class EvolutionaryRollbackEngine {
    private static rollbackHistory;
    /**
     * Registra sugerencia para posible rollback
     */
    static registerForRollback(suggestion: EvolutionarySuggestion): void;
    /**
     * Ejecuta rollback de decisión evolutiva
     */
    static rollbackEvolutionaryDecision(suggestionId: string): Promise<RollbackResult>;
    /**
     * Rollback por componente específico
     */
    private static rollbackByComponent;
    /**
     * Rollback de consensus engine
     */
    private static rollbackConsensusEngine;
    /**
     * Rollback de memory pool
     */
    private static rollbackMemoryPool;
    /**
     * Rollback de creative engine
     */
    private static rollbackCreativeEngine;
    /**
     * Rollback de harmony system
     */
    private static rollbackHarmonySystem;
    /**
     * Rollback genérico
     */
    private static rollbackGeneric;
    /**
     * Rollback masivo de múltiples decisiones
     */
    static rollbackMultipleDecisions(suggestionIds: string[]): Promise<RollbackResult[]>;
    /**
     * Limpia historial de rollback antiguo
     */
    static cleanupOldRollbackData(maxAgeHours?: number): number;
    /**
     * Obtiene estadísticas de rollback
     */
    static getRollbackStats(): {
        totalRegistered: number;
        oldestEntry: number;
        newestEntry: number;
    };
}
//# sourceMappingURL=evolutionary-rollback-engine.d.ts.map