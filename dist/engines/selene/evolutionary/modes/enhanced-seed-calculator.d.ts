/**
 * 🌱 ENHANCED SEED CALCULATOR
 *
 * Calculador de seeds con soporte para múltiples modos.
 * Combina Fibonacci (determinista) + Entropy (configurable) + Feedback + Punk Boost
 *
 * @author PunkClaude + Radwulf
 * @date 2025-10-23
 */
import type { ModeConfig } from './mode-manager.js';
import type { Redis } from 'ioredis';
/**
 * System Vitals interface (temporary - will use from core later)
 */
export interface SystemVitals {
    health: number;
    stress: number;
    harmony: number;
    creativity: number;
}
/**
 * Calculador de seeds con soporte para múltiples modos
 *
 * Combina:
 * - Fibonacci base (determinista)
 * - Entropy injection (configurable)
 * - Feedback loop weights (aprendizaje)
 * - Punk type boosting (creatividad)
 */
export declare class EnhancedSeedCalculator {
    private redis?;
    private fibonacciCache;
    constructor(redis?: Redis);
    /**
     * Calcula seed combinado según modo activo
     *
     * @param vitals - Vitales del sistema
     * @param modeConfig - Configuración del modo actual
     * @returns Seed calculado (0-100)
     *
     * Fórmula:
     * seed = (fibonacci + entropy + feedback + punkBoost) % 100
     *
     * Donde:
     * - fibonacci: Basado en vitals (determinista)
     * - entropy: Aleatorio controlado por entropyFactor
     * - feedback: Ajuste basado en ratings (feedbackInfluence)
     * - punkBoost: Boost para tipos punk (punkProbability)
     */
    calculateSeed(vitals: SystemVitals, modeConfig: ModeConfig): Promise<number>;
    /**
     * Fibonacci base (determinista, cacheable)
     *
     * @param n - Número de entrada
     * @returns Fibonacci(n) % 100
     */
    private fibonacci;
    /**
     * Genera entropía controlada
     *
     * @param entropyFactor - Factor de entropía (0-100)
     * @returns Entropía generada
     *
     * Comportamiento:
     * - Factor 0: Sin entropía (determinista)
     * - Factor 50: Entropía moderada (~0-50)
     * - Factor 100: Entropía máxima (~0-100)
     *
     * NOTA: Aquí SÍ usamos Math.random() controlado por factor
     */
    private getEntropy;
    /**
     * Obtiene ajuste del feedback loop
     *
     * @param feedbackInfluence - Influencia del feedback (0-100)
     * @returns Ajuste calculado (-20 a +20)
     *
     * Comportamiento:
     * - Influence 0: Sin ajuste
     * - Influence 100: Ajuste máximo según ratings
     *
     * Lee de Redis: selene:evolution:type_weights
     */
    private getFeedbackAdjustment;
    /**
     * Calcula boost para tipos punk
     *
     * @param punkProbability - Probabilidad de punk types (0-100)
     * @returns Boost calculado (0-30)
     *
     * Comportamiento:
     * - Probability 0: Sin boost
     * - Probability 50: Boost moderado (~15)
     * - Probability 100: Boost máximo (~30)
     */
    private getPunkBoost;
    /**
     * Limpia cache de Fibonacci (útil para testing)
     */
    clearCache(): void;
}
//# sourceMappingURL=enhanced-seed-calculator.d.ts.map