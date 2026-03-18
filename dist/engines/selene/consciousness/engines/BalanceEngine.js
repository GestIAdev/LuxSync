/**
 * ⚖️ BALANCE ENGINE
 * "La armonía no es casualidad - es disciplina consciente"
 *
 * CAPACIDAD:
 * - Monitorea beauty y fibonacci drift
 * - Auto-corrige cuando divergencia >5%
 * - Sugiere ajustes de parámetros
 */
export class BalanceEngine {
    targetBeautyMin = 0.85;
    targetBeautyMax = 0.95;
    targetBeautyIdeal = 0.90;
    targetFibonacciMin = 1.5;
    targetFibonacciMax = 1.8;
    targetFibonacciIdeal = 1.618; // Golden ratio
    maxDriftTolerance = 0.05; // 5%
    /**
     * 📊 ANALIZAR BALANCE actual
     */
    analyzeBalance(avgBeauty, avgFibonacci) {
        // Calcular drift
        const beautyDrift = Math.abs(avgBeauty - this.targetBeautyIdeal);
        const fibonacciDrift = Math.abs(avgFibonacci - this.targetFibonacciIdeal);
        const needsCorrection = beautyDrift > this.maxDriftTolerance ||
            fibonacciDrift > this.maxDriftTolerance;
        const suggestedActions = [];
        // Beauty corrections
        if (avgBeauty < this.targetBeautyMin) {
            suggestedActions.push('Increase pattern diversity - too repetitive');
        }
        else if (avgBeauty > this.targetBeautyMax) {
            suggestedActions.push('Reduce noise - patterns too volatile');
        }
        // Fibonacci corrections
        if (avgFibonacci < this.targetFibonacciMin) {
            suggestedActions.push('Increase consensus threshold - too fast convergence');
        }
        else if (avgFibonacci > this.targetFibonacciMax) {
            suggestedActions.push('Decrease consensus threshold - too slow convergence');
        }
        return {
            currentBeauty: avgBeauty,
            targetBeauty: this.targetBeautyIdeal,
            beautyDrift,
            currentFibonacci: avgFibonacci,
            targetFibonacci: this.targetFibonacciIdeal,
            fibonacciDrift,
            needsCorrection,
            suggestedActions,
        };
    }
    /**
     * 🔧 AUTO-CORREGIR (si es posible)
     * Retorna parámetros ajustados
     */
    autoCorrect(currentParams, metrics) {
        const changesApplied = [];
        let { beautyWeight, fibonacciWeight, consensusThreshold } = currentParams;
        // Beauty corrections
        if (metrics.currentBeauty < this.targetBeautyMin) {
            beautyWeight = Math.min(1.0, beautyWeight + 0.05);
            changesApplied.push(`Increased beauty weight to ${beautyWeight.toFixed(2)}`);
        }
        else if (metrics.currentBeauty > this.targetBeautyMax) {
            beautyWeight = Math.max(0.5, beautyWeight - 0.05);
            changesApplied.push(`Decreased beauty weight to ${beautyWeight.toFixed(2)}`);
        }
        // Fibonacci corrections
        if (metrics.currentFibonacci < this.targetFibonacciMin) {
            fibonacciWeight = Math.min(1.0, fibonacciWeight + 0.05);
            changesApplied.push(`Increased fibonacci weight to ${fibonacciWeight.toFixed(2)}`);
        }
        else if (metrics.currentFibonacci > this.targetFibonacciMax) {
            fibonacciWeight = Math.max(0.5, fibonacciWeight - 0.05);
            changesApplied.push(`Decreased fibonacci weight to ${fibonacciWeight.toFixed(2)}`);
        }
        return {
            beautyWeight,
            fibonacciWeight,
            consensusThreshold,
            changesApplied,
        };
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS de balance
     */
    getBalanceStats(metrics) {
        const beautyStatus = metrics.beautyDrift < 0.02 ? 'EXCELLENT' :
            metrics.beautyDrift < 0.05 ? 'GOOD' : 'NEEDS_ATTENTION';
        const fibonacciStatus = metrics.fibonacciDrift < 0.02 ? 'EXCELLENT' :
            metrics.fibonacciDrift < 0.05 ? 'GOOD' : 'NEEDS_ATTENTION';
        const overallBalance = (!metrics.needsCorrection) ? 'BALANCED' :
            (metrics.beautyDrift > 0.1 || metrics.fibonacciDrift > 0.1) ? 'CRITICAL' : 'REQUIRES_ATTENTION';
        return {
            beautyStatus,
            fibonacciStatus,
            overallBalance,
            correctionNeeded: metrics.needsCorrection,
            actionCount: metrics.suggestedActions.length,
        };
    }
    /**
     * 🎯 VALIDAR PARÁMETROS dentro de rangos seguros
     */
    validateParameters(params) {
        const issues = [];
        if (params.beautyWeight < 0.1 || params.beautyWeight > 1.0) {
            issues.push(`Beauty weight out of range: ${params.beautyWeight} (should be 0.1-1.0)`);
        }
        if (params.fibonacciWeight < 0.1 || params.fibonacciWeight > 1.0) {
            issues.push(`Fibonacci weight out of range: ${params.fibonacciWeight} (should be 0.1-1.0)`);
        }
        if (params.consensusThreshold < 0.5 || params.consensusThreshold > 0.95) {
            issues.push(`Consensus threshold out of range: ${params.consensusThreshold} (should be 0.5-0.95)`);
        }
        return {
            isValid: issues.length === 0,
            issues,
        };
    }
}
//# sourceMappingURL=BalanceEngine.js.map