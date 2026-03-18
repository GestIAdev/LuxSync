/**
 * 🏰 DECISION CONTAINMENT SYSTEM
 * Contiene impacto de decisiones evolutivas
 * "La evolución debe estar enjaulada, no suelta"
 */
import { EvolutionarySuggestion } from '../interfaces/evolutionary-engine-interfaces.js';
export interface ContainmentResult {
    contained: boolean;
    containmentActions: string[];
    rollbackPlan: string[];
    monitoringLevel: 'none' | 'basic' | 'enhanced' | 'intensive';
}
export declare class DecisionContainmentSystem {
    /**
     * Aplica contención a sugerencia evolutiva
     */
    static containEvolutionaryDecision(suggestion: EvolutionarySuggestion, containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum'): ContainmentResult;
    /**
     * Agrega contención específica del tipo de decisión
     */
    private static addDecisionSpecificContainment;
    /**
     * Verifica si decisión está contenida
     */
    static verifyContainment(suggestion: EvolutionarySuggestion, containment: ContainmentResult): boolean;
    /**
     * Ejecuta acciones de rollback de contención
     */
    static executeContainmentRollback(suggestion: EvolutionarySuggestion, rollbackPlan: string[]): Promise<boolean>;
    /**
     * Ejecuta acción específica de rollback
     */
    private static executeRollbackAction;
}
//# sourceMappingURL=decision-containment-system.d.ts.map