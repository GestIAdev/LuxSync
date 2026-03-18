/**
 * 🔍 PATTERN SANITY CHECKER
 * Verifica cordura de patrones antes de usarlos
 * "La locura creativa debe tener límites matemáticos"
 */
import { EvolutionaryPattern } from '../interfaces/evolutionary-engine-interfaces.js';
export interface SanityCheckResult {
    isSane: boolean;
    issues: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
}
export declare class PatternSanityChecker {
    private static readonly MAX_FIBONACCI_VALUE;
    private static readonly MIN_FIBONACCI_VALUE;
    private static readonly MAX_RATIO_CHANGE;
    private static readonly MIN_RATIO_CHANGE;
    /**
     * Verifica cordura de patrón evolutivo
     */
    static checkPatternSanity(pattern: EvolutionaryPattern): SanityCheckResult;
    /**
     * Verifica valores fibonacci
     */
    private static checkFibonacciValues;
    /**
     * Verifica ratios fibonacci
     */
    private static checkFibonacciRatios;
    /**
     * Verifica posición zodiacal
     */
    private static checkZodiacPosition;
    /**
     * Verifica clave musical
     */
    private static checkMusicalKey;
    /**
     * Verifica ratio de armonía
     */
    private static checkHarmonyRatio;
    /**
     * Determina severidad de issues
     */
    private static determineSeverity;
    /**
     * Verifica lote de patrones
     */
    static checkPatternBatch(patterns: EvolutionaryPattern[]): SanityCheckResult[];
}
//# sourceMappingURL=pattern-sanity-checker.d.ts.map