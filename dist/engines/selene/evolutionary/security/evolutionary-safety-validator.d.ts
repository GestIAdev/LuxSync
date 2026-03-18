/**
 * 🛡️ EVOLUTIONARY SAFETY VALIDATOR
 * Valida que decisiones evolutivas no sean peligrosas
 * "La evolución debe crear, no destruir"
 */
import { EvolutionaryDecisionType, EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';
export interface SafetyValidationResult {
    isSafe: boolean;
    riskLevel: number;
    concerns: string[];
    recommendations: string[];
    containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum';
}
export declare class EvolutionarySafetyValidator {
    private static readonly DANGEROUS_PATTERNS;
    private static readonly HIGH_RISK_ZODIAC;
    private static readonly HIGH_RISK_MUSICAL_KEYS;
    /**
     * Valida seguridad de un tipo de decisión evolutiva
     */
    static validateEvolutionaryDecision(decision: EvolutionaryDecisionType, context: EvolutionContext): SafetyValidationResult;
    /**
     * Verifica patrones peligrosos
     */
    private static checkDangerousPatterns;
    /**
     * Valida límites de secuencia fibonacci
     */
    private static validateFibonacciBounds;
    /**
     * Evalúa estabilidad del sistema
     */
    private static assessSystemStability;
    /**
     * Determina nivel de contención
     */
    private static determineContainmentLevel;
    /**
     * Valida lote de decisiones evolutivas
     */
    static validateEvolutionBatch(decisions: EvolutionaryDecisionType[], context: EvolutionContext): SafetyValidationResult[];
}
//# sourceMappingURL=evolutionary-safety-validator.d.ts.map