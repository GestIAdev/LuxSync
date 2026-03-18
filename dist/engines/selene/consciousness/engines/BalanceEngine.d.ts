/**
 * ⚖️ BALANCE ENGINE
 * "La armonía no es casualidad - es disciplina consciente"
 *
 * CAPACIDAD:
 * - Monitorea beauty y fibonacci drift
 * - Auto-corrige cuando divergencia >5%
 * - Sugiere ajustes de parámetros
 */
interface BalanceMetrics {
    currentBeauty: number;
    targetBeauty: number;
    beautyDrift: number;
    currentFibonacci: number;
    targetFibonacci: number;
    fibonacciDrift: number;
    needsCorrection: boolean;
    suggestedActions: string[];
}
export declare class BalanceEngine {
    private readonly targetBeautyMin;
    private readonly targetBeautyMax;
    private readonly targetBeautyIdeal;
    private readonly targetFibonacciMin;
    private readonly targetFibonacciMax;
    private readonly targetFibonacciIdeal;
    private readonly maxDriftTolerance;
    /**
     * 📊 ANALIZAR BALANCE actual
     */
    analyzeBalance(avgBeauty: number, avgFibonacci: number): BalanceMetrics;
    /**
     * 🔧 AUTO-CORREGIR (si es posible)
     * Retorna parámetros ajustados
     */
    autoCorrect(currentParams: {
        beautyWeight: number;
        fibonacciWeight: number;
        consensusThreshold: number;
    }, metrics: BalanceMetrics): {
        beautyWeight: number;
        fibonacciWeight: number;
        consensusThreshold: number;
        changesApplied: string[];
    };
    /**
     * 📊 OBTENER ESTADÍSTICAS de balance
     */
    getBalanceStats(metrics: BalanceMetrics): {
        beautyStatus: string;
        fibonacciStatus: string;
        overallBalance: string;
        correctionNeeded: boolean;
        actionCount: number;
    };
    /**
     * 🎯 VALIDAR PARÁMETROS dentro de rangos seguros
     */
    validateParameters(params: {
        beautyWeight: number;
        fibonacciWeight: number;
        consensusThreshold: number;
    }): {
        isValid: boolean;
        issues: string[];
    };
}
export {};
//# sourceMappingURL=BalanceEngine.d.ts.map