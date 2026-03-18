// evolutionary-rollback-engine.ts
/**
 * 🔄 EVOLUTIONARY ROLLBACK ENGINE
 * Rollback específico para decisiones evolutivas
 * "La evolución puede equivocarse, pero siempre puede volver atrás"
 */
export class EvolutionaryRollbackEngine {
    static rollbackHistory = new Map();
    /**
     * Registra sugerencia para posible rollback
     */
    static registerForRollback(suggestion) {
        this.rollbackHistory.set(suggestion.id, { suggestion: { ...suggestion }, timestamp: Date.now() });
    }
    /**
     * Ejecuta rollback de decisión evolutiva
     */
    static async rollbackEvolutionaryDecision(suggestionId) {
        const startTime = Date.now();
        const result = {
            success: false,
            rolledBackComponents: [],
            errors: [],
            recoveryTime: 0
        };
        try {
            const entry = this.rollbackHistory.get(suggestionId);
            if (!entry) {
                result.errors.push(`Suggestion ${suggestionId} not found in rollback history`);
                return result;
            }
            const suggestion = entry.suggestion;
            console.log(`🔄 [ROLLBACK] Starting rollback for suggestion ${suggestionId}`);
            // Ejecutar rollback por componente
            await this.rollbackByComponent(suggestion, result);
            result.success = result.errors.length === 0;
            result.recoveryTime = Date.now() - startTime;
            console.log(`🔄 [ROLLBACK] Rollback completed in ${result.recoveryTime}ms`);
        }
        catch (error) {
            result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
            result.recoveryTime = Date.now() - startTime;
        }
        return result;
    }
    /**
     * Rollback por componente específico
     */
    static async rollbackByComponent(suggestion, result) {
        const target = suggestion.targetComponent;
        switch (target) {
            case 'consensus-engine':
                await this.rollbackConsensusEngine(suggestion, result);
                break;
            case 'memory-pool':
                await this.rollbackMemoryPool(suggestion, result);
                break;
            case 'creative-engine':
                await this.rollbackCreativeEngine(suggestion, result);
                break;
            case 'harmony-system':
                await this.rollbackHarmonySystem(suggestion, result);
                break;
            default:
                await this.rollbackGeneric(suggestion, result);
                break;
        }
    }
    /**
     * Rollback de consensus engine
     */
    static async rollbackConsensusEngine(suggestion, result) {
        console.log('🔄 [ROLLBACK] Rolling back consensus engine parameters');
        try {
            // Simular rollback de parámetros del consensus engine
            await new Promise(resolve => setTimeout(resolve, 200));
            result.rolledBackComponents.push('consensus-engine');
        }
        catch (error) {
            result.errors.push(`Consensus engine rollback failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Rollback de memory pool
     */
    static async rollbackMemoryPool(suggestion, result) {
        console.log('🔄 [ROLLBACK] Rolling back memory pool allocation');
        try {
            // Simular rollback de asignación de memoria
            await new Promise(resolve => setTimeout(resolve, 150));
            result.rolledBackComponents.push('memory-pool');
        }
        catch (error) {
            result.errors.push(`Memory pool rollback failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Rollback de creative engine
     */
    static async rollbackCreativeEngine(suggestion, result) {
        console.log('🔄 [ROLLBACK] Rolling back creative engine parameters');
        try {
            // Simular rollback de parámetros creativos
            await new Promise(resolve => setTimeout(resolve, 100));
            result.rolledBackComponents.push('creative-engine');
        }
        catch (error) {
            result.errors.push(`Creative engine rollback failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Rollback de harmony system
     */
    static async rollbackHarmonySystem(suggestion, result) {
        console.log('🔄 [ROLLBACK] Rolling back harmony system settings');
        try {
            // Simular rollback de configuraciones de armonía
            await new Promise(resolve => setTimeout(resolve, 120));
            result.rolledBackComponents.push('harmony-system');
        }
        catch (error) {
            result.errors.push(`Harmony system rollback failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Rollback genérico
     */
    static async rollbackGeneric(suggestion, result) {
        console.log(`🔄 [ROLLBACK] Rolling back generic component: ${suggestion.targetComponent}`);
        try {
            // Simular rollback genérico
            await new Promise(resolve => setTimeout(resolve, 100));
            result.rolledBackComponents.push(suggestion.targetComponent);
        }
        catch (error) {
            result.errors.push(`Generic rollback failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Rollback masivo de múltiples decisiones
     */
    static async rollbackMultipleDecisions(suggestionIds) {
        const results = [];
        for (const id of suggestionIds) {
            const result = await this.rollbackEvolutionaryDecision(id);
            results.push(result);
        }
        return results;
    }
    /**
     * Limpia historial de rollback antiguo
     */
    static cleanupOldRollbackData(maxAgeHours = 24) {
        // Si maxAgeHours === 0, limpiar TODO
        if (maxAgeHours === 0) {
            const count = this.rollbackHistory.size;
            this.rollbackHistory.clear();
            console.log(`🧹 [ROLLBACK] Cleaned up ALL ${count} rollback entries (maxAgeHours=0)`);
            return count;
        }
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;
        for (const [id, entry] of this.rollbackHistory.entries()) {
            if (entry.timestamp < cutoffTime) {
                this.rollbackHistory.delete(id);
                cleaned++;
            }
        }
        console.log(`🧹 [ROLLBACK] Cleaned up ${cleaned} old rollback entries`);
        return cleaned;
    }
    /**
     * Obtiene estadísticas de rollback
     */
    static getRollbackStats() {
        const entries = Array.from(this.rollbackHistory.values());
        if (entries.length === 0) {
            return {
                totalRegistered: 0,
                oldestEntry: 0,
                newestEntry: 0
            };
        }
        const timestamps = entries.map(e => e.timestamp);
        return {
            totalRegistered: entries.length,
            oldestEntry: Math.min(...timestamps),
            newestEntry: Math.max(...timestamps)
        };
    }
}
//# sourceMappingURL=evolutionary-rollback-engine.js.map