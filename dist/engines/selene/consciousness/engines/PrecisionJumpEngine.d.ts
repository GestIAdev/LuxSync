/**
 * 🎯 PRECISION JUMP ENGINE
 * "El momento perfecto no es fijo - es adaptativo"
 *
 * CAPACIDAD:
 * - Ajusta window size para insights (5-50 observaciones)
 * - Ventana pequeña (5-10) en alta volatilidad
 * - Ventana grande (30-50) en estabilidad
 */
interface SystemVolatility {
    beautyVariance: number;
    convergenceVariance: number;
    patternSwitchRate: number;
    overallVolatility: 'low' | 'medium' | 'high';
}
export declare class PrecisionJumpEngine {
    private readonly minWindow;
    private readonly maxWindow;
    private readonly defaultWindow;
    /**
     * 📊 CALCULAR VOLATILIDAD del sistema
     */
    calculateVolatility(recentPatterns: Array<{
        beauty: number;
        convergenceTime: number;
        note: string;
    }>): SystemVolatility;
    /**
     * 🎯 CALCULAR WINDOW SIZE óptima
     */
    calculateOptimalWindow(volatility: SystemVolatility): number;
    /**
     * 📈 RECOMENDAR PRÓXIMO INSIGHT TIMING
     */
    recommendInsightTiming(currentExperience: number, volatility: SystemVolatility): {
        nextInsightAt: number;
        reasoning: string;
    };
    /**
     * 📊 OBTENER ESTADÍSTICAS de volatilidad
     */
    getVolatilityStats(volatility: SystemVolatility): {
        volatilityLevel: string;
        beautyStability: string;
        timeStability: string;
        patternStability: string;
        recommendedWindow: number;
    };
}
export {};
//# sourceMappingURL=PrecisionJumpEngine.d.ts.map