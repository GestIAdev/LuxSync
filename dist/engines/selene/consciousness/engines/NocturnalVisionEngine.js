export class NocturnalVisionEngine {
    redis;
    historyKey = 'selene:consensus:history';
    maxHistorySize = 100; // Mantener últimos 100 consensos
    constructor(redis) {
        this.redis = redis;
    } /**
     * 📊 REGISTRAR CONSENSO: Guardar para análisis predictivo
     */
    async recordConsensus(event) {
        try {
            // Crear entrada para Redis
            const entry = JSON.stringify({
                ...event,
                timestamp: event.timestamp.toISOString()
            });
            // Agregar al final de la lista (más reciente)
            await this.redis.rpush(this.historyKey, entry);
            // Mantener solo los últimos 100
            const currentSize = await this.redis.llen(this.historyKey);
            if (currentSize > this.maxHistorySize) {
                const excess = currentSize - this.maxHistorySize;
                await this.redis.ltrim(this.historyKey, excess, -1);
            }
            console.log(`🌙 [NOCTURNAL VISION] Consensus recorded: ${event.note}-${event.zodiacSign} (${event.beauty.toFixed(3)})`);
        }
        catch (error) {
            console.error('🌙 [NOCTURNAL VISION] Error recording consensus:', error);
        }
    }
    /**
     * 🔮 PREDECIR PRÓXIMO CONSENSO
     */
    async predictNext() {
        try {
            // Obtener últimos 10 consensos
            const rawHistory = await this.redis.lrange(this.historyKey, -10, -1);
            if (rawHistory.length < 5) {
                return {
                    predictedNote: 'UNKNOWN',
                    predictedSign: 'UNKNOWN',
                    confidence: 0,
                    reasoning: 'Insufficient history (< 5 consensuses)',
                    anomalyDetected: false
                };
            }
            const history = rawHistory.map((entry) => {
                const parsed = JSON.parse(entry);
                return {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp)
                };
            });
            // Análisis de frecuencia
            const noteFreq = this.calculateFrequency(history, 'note');
            const signFreq = this.calculateFrequency(history, 'zodiacSign');
            // Detectar trend
            const trend = this.detectTrend(history.slice(-5).map(h => h.note), history.slice(-10, -5).map(h => h.note));
            // Calcular estabilidad de convergencia
            const stability = this.calculateConvergenceStability(history);
            // Predicción basada en frecuencia + trend + estabilidad
            const predictedNote = noteFreq[0].value;
            const predictedSign = signFreq[0].value;
            let confidence = noteFreq[0].count / history.length;
            let anomalyDetected = false;
            // Ajustar confidence por trend
            if (trend === 'stable') {
                confidence = Math.min(confidence * 1.2, 0.95); // Boost en estabilidad
            }
            else {
                confidence *= 0.8; // Penalizar en cambio
            }
            // Ajustar por estabilidad de convergencia
            confidence *= stability;
            // Detectar anomalía
            if (confidence < 0.7) {
                anomalyDetected = true;
            }
            const reasoning = this.generateReasoning(noteFreq, signFreq, trend, stability, confidence);
            return {
                predictedNote,
                predictedSign,
                confidence,
                reasoning,
                anomalyDetected
            };
        }
        catch (error) {
            console.error('🌙 [NOCTURNAL VISION] Error predicting next:', error);
            return {
                predictedNote: 'ERROR',
                predictedSign: 'ERROR',
                confidence: 0,
                reasoning: `Prediction error: ${error.message}`,
                anomalyDetected: true
            };
        }
    }
    /**
     * 📈 CALCULAR FRECUENCIA: Helper para contar ocurrencias
     */
    calculateFrequency(history, field) {
        const counts = new Map();
        history.forEach(event => {
            const value = event[field];
            counts.set(value, (counts.get(value) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);
    }
    /**
     * 📊 DETECTAR TENDENCIA: Comparar ventanas temporales
     */
    detectTrend(recent, older) {
        if (recent.length === 0 || older.length === 0)
            return 'shifting';
        const recentSet = new Set(recent);
        const olderSet = new Set(older);
        // Calcular overlap
        const intersection = new Set();
        recentSet.forEach(x => { if (olderSet.has(x))
            intersection.add(x); });
        const union = new Set(recentSet);
        olderSet.forEach(x => union.add(x));
        const overlapRatio = intersection.size / union.size;
        return overlapRatio > 0.6 ? 'stable' : 'shifting';
    }
    /**
     * ⏱️ ESTABILIDAD DE CONVERGENCIA: Analizar tiempos
     */
    calculateConvergenceStability(history) {
        const times = history.map(e => e.convergenceTime);
        if (times.length < 3)
            return 0.5;
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / mean;
        // Baja varianza = alta estabilidad (0.0-1.0)
        return Math.max(0, 1 - (coefficientOfVariation / 2));
    }
    /**
     * 📊 GENERAR RAZONAMIENTO
     */
    generateReasoning(noteFreq, signFreq, trend, stability, confidence) {
        const parts = [];
        parts.push(`Top note: ${noteFreq[0].value} (${noteFreq[0].count} times)`);
        parts.push(`Top sign: ${signFreq[0].value} (${signFreq[0].count} times)`);
        parts.push(`Trend: ${trend}`);
        parts.push(`Stability: ${(stability * 100).toFixed(1)}%`);
        if (confidence > 0.9) {
            parts.push('HIGH CONFIDENCE: Stable pattern detected');
        }
        else if (confidence > 0.7) {
            parts.push('MEDIUM CONFIDENCE: Some pattern emerging');
        }
        else {
            parts.push('LOW CONFIDENCE: Pattern unclear or shifting');
        }
        return parts.join(' | ');
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    async getStats() {
        const rawHistory = await this.redis.lrange(this.historyKey, 0, -1);
        const history = rawHistory.map((entry) => {
            const parsed = JSON.parse(entry);
            return {
                ...parsed,
                timestamp: new Date(parsed.timestamp)
            };
        });
        return {
            historySize: history.length,
            predictionAccuracy: 0 // TODO: Implementar
        };
    }
}
//# sourceMappingURL=NocturnalVisionEngine.js.map