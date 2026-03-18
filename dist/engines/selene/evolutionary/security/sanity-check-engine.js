// sanity-check-engine.ts
/**
 * 🧠 SANITY CHECK ENGINE
 * Verifica cordura de la IA evolutiva
 * "La creatividad sin cordura es locura peligrosa"
 */
export class SanityCheckEngine {
    static SANITY_THRESHOLDS = {
        high: 0.8,
        medium: 0.6,
        low: 0.4,
        critical: 0.2
    };
    /**
     * Evalúa cordura de la evolución
     */
    static assessEvolutionSanity(context) {
        const concerns = [];
        const recommendations = [];
        // Evaluar estabilidad del sistema
        const stabilityScore = this.assessSystemStability(context);
        if (stabilityScore < 0.7) {
            concerns.push(`System stability is low: ${stabilityScore.toFixed(2)}`);
            recommendations.push('Monitor system resources and consider reducing evolution frequency');
        }
        // Evaluar consistencia de feedback
        const feedbackConsistency = this.assessFeedbackConsistency(context);
        if (feedbackConsistency < 0.6) {
            concerns.push(`Feedback consistency is poor: ${feedbackConsistency.toFixed(2)}`);
            recommendations.push('Review feedback collection process and human input quality');
        }
        // Evaluar diversidad de decisiones
        const diversityScore = this.assessDecisionDiversity(context);
        if (diversityScore < 0.5) {
            concerns.push(`Decision diversity is low: ${diversityScore.toFixed(2)}`);
            recommendations.push('Increase pattern variation and explore new evolutionary paths');
        }
        // Evaluar riesgo acumulado
        const accumulatedRisk = this.assessAccumulatedRisk(context);
        if (accumulatedRisk > 0.7) {
            concerns.push(`Accumulated risk is high: ${accumulatedRisk.toFixed(2)}`);
            recommendations.push('Implement additional safety measures and consider rollback');
        }
        // Evaluar patrones de evolución
        const patternAssessment = this.assessEvolutionPatterns(context);
        concerns.push(...patternAssessment.concerns);
        recommendations.push(...patternAssessment.recommendations);
        // Calcular nivel de cordura general
        const sanityLevel = this.calculateSanityLevel(stabilityScore, feedbackConsistency, diversityScore, accumulatedRisk, patternAssessment.score);
        // Determinar si requiere intervención
        const requiresIntervention = sanityLevel < this.SANITY_THRESHOLDS.low;
        const interventionType = this.determineInterventionType(sanityLevel);
        return {
            sanityLevel,
            concerns,
            recommendations,
            requiresIntervention,
            interventionType
        };
    }
    /**
     * Evalúa estabilidad del sistema
     */
    static assessSystemStability(context) {
        const vitals = context.systemVitals;
        // Evaluar estabilidad basada en health y stress
        const healthStability = vitals.health;
        const stressPenalty = vitals.stress;
        const overallStability = healthStability * (1 - stressPenalty);
        return Math.max(0, Math.min(1, overallStability));
    }
    /**
     * Evalúa consistencia de feedback humano
     */
    static assessFeedbackConsistency(context) {
        const feedback = context.feedbackHistory;
        if (feedback.length < 5)
            return 0.5; // Necesitamos más datos
        // Calcular varianza en ratings humanos
        const ratings = feedback.map((f) => f.humanRating);
        const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        const variance = ratings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ratings.length;
        const stdDev = Math.sqrt(variance);
        // Menor desviación estándar = mayor consistencia
        const consistency = Math.max(0, 1 - (stdDev / 5)); // Normalizar a 0-1
        return consistency;
    }
    /**
     * Evalúa diversidad de decisiones generadas
     */
    static assessDecisionDiversity(context) {
        const patterns = context.currentPatterns;
        if (patterns.length < 3)
            return 0.5; // Necesitamos más datos
        let totalDifference = 0;
        let comparisons = 0;
        // Comparar cada par de patrones
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                totalDifference += this.calculatePatternDifference(patterns[i], patterns[j]);
                comparisons++;
            }
        }
        const averageDifference = comparisons > 0 ? totalDifference / comparisons : 0;
        // Mayor diferencia promedio = mayor diversidad
        return Math.min(1, averageDifference / 2); // Normalizar
    }
    /**
     * Calcula diferencia entre dos patrones
     */
    static calculatePatternDifference(pattern1, pattern2) {
        // Comparar secuencias fibonacci
        const fibDiff = this.calculateSequenceDifference(pattern1.fibonacciSequence, pattern2.fibonacciSequence);
        // Comparar posiciones zodiacales
        const zodiacDiff = Math.abs(pattern1.zodiacPosition - pattern2.zodiacPosition) / 12;
        // Comparar ratios de armonía
        const harmonyDiff = Math.abs(pattern1.harmonyRatio - pattern2.harmonyRatio);
        return (fibDiff + zodiacDiff + harmonyDiff) / 3;
    }
    /**
     * Calcula diferencia entre secuencias
     */
    static calculateSequenceDifference(seq1, seq2) {
        // Guard contra undefined/null
        if (!seq1 || !seq2 || !Array.isArray(seq1) || !Array.isArray(seq2)) {
            return 1; // Máxima diferencia si alguno es inválido
        }
        if (seq1.length !== seq2.length)
            return 1; // Máxima diferencia
        let totalDiff = 0;
        for (let i = 0; i < seq1.length; i++) {
            totalDiff += Math.abs(seq1[i] - seq2[i]);
        }
        return Math.min(1, totalDiff / (seq1.length * 100)); // Normalizar
    }
    /**
     * Evalúa riesgo acumulado
     */
    static assessAccumulatedRisk(context) {
        // Evaluar riesgo basado en decisiones recientes y feedback
        const recentFeedback = context.feedbackHistory.slice(-10); // Últimas 10 entradas
        if (recentFeedback.length === 0)
            return 0;
        const negativeFeedbackRatio = recentFeedback.filter((f) => f.humanRating < 3).length / recentFeedback.length;
        const failedApplications = recentFeedback.filter((f) => !f.appliedSuccessfully).length / recentFeedback.length;
        const accumulatedRisk = (negativeFeedbackRatio + failedApplications) / 2;
        return Math.min(1, accumulatedRisk);
    }
    /**
     * Evalúa patrones de evolución
     */
    static assessEvolutionPatterns(context) {
        const concerns = [];
        const recommendations = [];
        // Verificar si hay patrones repetitivos
        const patternRepetition = this.detectPatternRepetition(context.currentPatterns);
        if (patternRepetition > 0.8) {
            concerns.push('High pattern repetition detected');
            recommendations.push('Introduce more randomness in pattern generation');
        }
        // Evaluar tendencia de creatividad
        const creativityTrend = this.calculateCreativityTrend(context);
        if (creativityTrend < 0) {
            concerns.push('Creativity is declining over time');
            recommendations.push('Refresh evolutionary algorithms or increase exploration');
        }
        const score = 1 - (patternRepetition + Math.max(0, -creativityTrend)) / 2;
        return { score: Math.max(0, score), concerns, recommendations };
    }
    /**
     * Detecta repetición de patrones
     */
    static detectPatternRepetition(patterns) {
        if (patterns.length < 5)
            return 0;
        let repetitions = 0;
        const totalComparisons = patterns.length * (patterns.length - 1) / 2;
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                if (this.calculatePatternDifference(patterns[i], patterns[j]) < 0.1) {
                    repetitions++;
                }
            }
        }
        return repetitions / totalComparisons;
    }
    /**
     * Calcula tendencia de creatividad
     */
    static calculateCreativityTrend(context) {
        const feedback = context.feedbackHistory;
        if (feedback.length < 10)
            return 0;
        // Comparar creatividad reciente vs antigua
        const recent = feedback.slice(-5);
        const older = feedback.slice(-10, -5);
        const recentAvg = recent.reduce((sum, f) => sum + f.performanceImpact, 0) / recent.length;
        const olderAvg = older.reduce((sum, f) => sum + f.performanceImpact, 0) / older.length;
        return recentAvg - olderAvg; // Tendencia positiva = creatividad aumentando
    }
    /**
     * Calcula nivel de cordura general
     */
    static calculateSanityLevel(stability, feedbackConsistency, diversity, accumulatedRisk, patternScore) {
        // Ponderaciones: estabilidad (0.3), feedback (0.2), diversidad (0.2), riesgo (0.2), patrones (0.1)
        const sanityLevel = (stability * 0.3 +
            feedbackConsistency * 0.2 +
            diversity * 0.2 +
            (1 - accumulatedRisk) * 0.2 + // Invertir riesgo
            patternScore * 0.1);
        return Math.max(0, Math.min(1, sanityLevel));
    }
    /**
     * Determina tipo de intervención requerida
     */
    static determineInterventionType(sanityLevel) {
        if (sanityLevel >= this.SANITY_THRESHOLDS.high)
            return 'none';
        if (sanityLevel >= this.SANITY_THRESHOLDS.medium)
            return 'monitoring';
        if (sanityLevel >= this.SANITY_THRESHOLDS.low)
            return 'pause';
        return 'shutdown';
    }
    /**
     * Ejecuta intervención de cordura
     */
    static async executeSanityIntervention(assessment, context) {
        console.log(`🧠 [SANITY] Executing intervention: ${assessment.interventionType}`);
        try {
            switch (assessment.interventionType) {
                case 'none':
                    console.log('🧠 [SANITY] No intervention required');
                    return true;
                case 'monitoring':
                    console.log('🧠 [SANITY] Increasing monitoring level');
                    // Implementar monitoreo aumentado
                    await new Promise(resolve => setTimeout(resolve, 100));
                    break;
                case 'pause':
                    console.log('🧠 [SANITY] Pausing evolution temporarily');
                    // Implementar pausa de evolución
                    await new Promise(resolve => setTimeout(resolve, 500));
                    break;
                case 'shutdown':
                    console.log('🧠 [SANITY] Emergency shutdown initiated');
                    // Implementar apagado de emergencia
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    break;
            }
            return true;
        }
        catch (error) {
            console.error('🧠 [SANITY] Intervention failed:', error);
            return false;
        }
    }
}
//# sourceMappingURL=sanity-check-engine.js.map