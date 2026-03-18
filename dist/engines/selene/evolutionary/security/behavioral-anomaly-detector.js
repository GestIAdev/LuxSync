import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
export class BehavioralAnomalyDetector {
    static redis;
    static ANOMALY_KEY = 'selene:evolution:anomalies';
    static BASELINE_KEY = 'selene:evolution:baseline';
    static ANOMALY_THRESHOLDS = {
        statistical: 3.0, // Standard deviations
        repetition: 0.8, // Repetition ratio
        frequency: 2.5, // Frequency multiplier
        consistency: 0.6 // Consistency score threshold
    };
    static getRedis() {
        if (!this.redis) {
            this.redis = new Redis();
        }
        return this.redis;
    }
    /**
     * Analiza anomalías en el comportamiento evolutivo
     */
    static async analyzeBehavioralAnomalies(recentDecisions, timeWindow = 3600000 // 1 hora
    ) {
        const anomalies = [];
        const now = Date.now();
        const windowStart = now - timeWindow;
        try {
            // Obtener baseline de comportamiento
            const baseline = await this.getBehavioralBaseline();
            // Detectar diferentes tipos de anomalías
            const statisticalAnomalies = await this.detectStatisticalAnomalies(recentDecisions, baseline);
            const repetitionAnomalies = await this.detectRepetitionAnomalies(recentDecisions, baseline);
            const frequencyAnomalies = await this.detectFrequencyAnomalies(recentDecisions, baseline);
            const consistencyAnomalies = await this.detectConsistencyAnomalies(recentDecisions, baseline);
            anomalies.push(...statisticalAnomalies, ...repetitionAnomalies, ...frequencyAnomalies, ...consistencyAnomalies);
            // Registrar anomalías detectadas
            if (anomalies.length > 0) {
                await this.recordAnomalies(anomalies);
            }
            // Actualizar baseline con nuevos datos
            await this.updateBehavioralBaseline(recentDecisions);
            return anomalies;
        }
        catch (error) {
            console.error('❌ [ANOMALY] Error analizando anomalías comportamentales:', error);
            return [];
        }
    }
    /**
     * Detecta anomalías estadísticas
     */
    static async detectStatisticalAnomalies(decisions, baseline) {
        const anomalies = [];
        for (const decision of decisions) {
            const stats = this.calculatePatternStatistics(decision, decisions);
            const baselineStats = baseline.find(b => b.patternId === decision.typeId);
            if (baselineStats) {
                const anomalyScore = this.calculateAnomalyScore(stats, baselineStats);
                if (anomalyScore > this.ANOMALY_THRESHOLDS.statistical) {
                    const severity = anomalyScore > 5 ? 'critical' : anomalyScore > 4 ? 'high' : 'medium';
                    anomalies.push({
                        type: 'statistical',
                        severity,
                        description: `Anomalía estadística en patrón ${decision.name}: score ${anomalyScore.toFixed(2)}`,
                        timestamp: Date.now(),
                        affectedPatterns: [decision.typeId],
                        anomalyScore,
                        recommendedAction: 'Revisar patrón y ajustar parámetros de evolución'
                    });
                }
            }
        }
        return anomalies;
    }
    /**
     * Detecta anomalías de repetición
     */
    static async detectRepetitionAnomalies(decisions, baseline) {
        const anomalies = [];
        const decisionCounts = new Map();
        // Contar repeticiones
        for (const decision of decisions) {
            decisionCounts.set(decision.typeId, (decisionCounts.get(decision.typeId) || 0) + 1);
        }
        for (const [patternId, count] of decisionCounts) {
            const repetitionRatio = count / decisions.length;
            const baselineStats = baseline.find(b => b.patternId === patternId);
            const expectedRatio = baselineStats ? baselineStats.frequency / baseline.length : 0.1;
            if (repetitionRatio > expectedRatio * this.ANOMALY_THRESHOLDS.repetition) {
                const severity = repetitionRatio > expectedRatio * 2 ? 'high' : 'medium';
                anomalies.push({
                    type: 'repetition',
                    severity,
                    description: `Repetición excesiva del patrón ${patternId}: ${repetitionRatio.toFixed(2)} vs esperado ${expectedRatio.toFixed(2)}`,
                    timestamp: Date.now(),
                    affectedPatterns: [patternId],
                    anomalyScore: repetitionRatio / expectedRatio,
                    recommendedAction: 'Diversificar generación de patrones'
                });
            }
        }
        return anomalies;
    }
    /**
     * Detecta anomalías de frecuencia
     */
    static async detectFrequencyAnomalies(decisions, baseline) {
        const anomalies = [];
        for (const decision of decisions) {
            const stats = this.calculatePatternStatistics(decision, decisions);
            const baselineStats = baseline.find(b => b.patternId === decision.typeId);
            if (baselineStats) {
                const frequencyRatio = stats.frequency / baselineStats.frequency;
                if (frequencyRatio > this.ANOMALY_THRESHOLDS.frequency) {
                    const severity = frequencyRatio > 4 ? 'critical' : frequencyRatio > 3 ? 'high' : 'medium';
                    anomalies.push({
                        type: 'frequency',
                        severity,
                        description: `Frecuencia anormal del patrón ${decision.name}: ${frequencyRatio.toFixed(2)}x baseline`,
                        timestamp: Date.now(),
                        affectedPatterns: [decision.typeId],
                        anomalyScore: frequencyRatio,
                        recommendedAction: 'Ajustar pesos de selección de patrones'
                    });
                }
            }
        }
        return anomalies;
    }
    /**
     * Detecta anomalías de consistencia
     */
    static async detectConsistencyAnomalies(decisions, baseline) {
        const anomalies = [];
        // Calcular consistencia general
        const consistencyScore = this.calculateConsistencyScore(decisions, baseline);
        if (consistencyScore < this.ANOMALY_THRESHOLDS.consistency) {
            const severity = consistencyScore < 0.3 ? 'critical' : consistencyScore < 0.4 ? 'high' : 'medium';
            anomalies.push({
                type: 'consistency',
                severity,
                description: `Baja consistencia comportamental: score ${consistencyScore.toFixed(2)}`,
                timestamp: Date.now(),
                affectedPatterns: decisions.map(d => d.typeId),
                anomalyScore: 1 - consistencyScore,
                recommendedAction: 'Revisar estabilidad del motor evolutivo'
            });
        }
        return anomalies;
    }
    /**
     * Obtiene baseline comportamental
     */
    static async getBehavioralBaseline() {
        try {
            const baselineData = await this.getRedis().get(this.BASELINE_KEY);
            return baselineData ? JSON.parse(baselineData) : [];
        }
        catch (error) {
            console.error('❌ [ANOMALY] Error obteniendo baseline:', error);
            return [];
        }
    }
    /**
     * Actualiza baseline comportamental
     */
    static async updateBehavioralBaseline(decisions) {
        try {
            const baseline = await this.getBehavioralBaseline();
            const updatedBaseline = new Map();
            // Actualizar estadísticas existentes
            for (const stat of baseline) {
                updatedBaseline.set(stat.patternId, stat);
            }
            // Agregar nuevas decisiones
            for (const decision of decisions) {
                const existing = updatedBaseline.get(decision.typeId);
                if (existing) {
                    existing.frequency = (existing.frequency + 1) / 2; // Media móvil
                    existing.totalOccurrences++;
                    existing.lastSeen = Date.now();
                }
                else {
                    updatedBaseline.set(decision.typeId, {
                        patternId: decision.typeId,
                        frequency: 1,
                        averageScore: decision.validationScore,
                        standardDeviation: 0,
                        lastSeen: Date.now(),
                        totalOccurrences: 1
                    });
                }
            }
            await this.getRedis().set(this.BASELINE_KEY, JSON.stringify(Array.from(updatedBaseline.values())));
        }
        catch (error) {
            console.error('❌ [ANOMALY] Error actualizando baseline:', error);
        }
    }
    /**
     * Registra anomalías detectadas
     */
    static async recordAnomalies(anomalies) {
        try {
            const existingAnomalies = await this.getRedis().get(this.ANOMALY_KEY);
            const allAnomalies = existingAnomalies ? JSON.parse(existingAnomalies) : [];
            allAnomalies.push(...anomalies);
            // Mantener solo últimas 1000 anomalías
            if (allAnomalies.length > 1000) {
                allAnomalies.splice(0, allAnomalies.length - 1000);
            }
            await this.getRedis().set(this.ANOMALY_KEY, JSON.stringify(allAnomalies));
            console.log(`🔍 [ANOMALY] Registradas ${anomalies.length} anomalías comportamentales`);
        }
        catch (error) {
            console.error('❌ [ANOMALY] Error registrando anomalías:', error);
        }
    }
    /**
     * Obtiene estadísticas de anomalías
     */
    static async getAnomalyStats(timeWindow = 86400000) {
        try {
            const anomaliesData = await this.getRedis().get(this.ANOMALY_KEY);
            const allAnomalies = anomaliesData ? JSON.parse(anomaliesData) : [];
            const cutoffTime = Date.now() - timeWindow;
            const recentAnomalies = allAnomalies.filter(a => a.timestamp > cutoffTime);
            const byType = {};
            const bySeverity = {};
            for (const anomaly of recentAnomalies) {
                byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
                bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
            }
            return {
                totalAnomalies: recentAnomalies.length,
                byType,
                bySeverity,
                recentAnomalies: recentAnomalies.slice(-10) // Últimas 10
            };
        }
        catch (error) {
            console.error('❌ [ANOMALY] Error obteniendo estadísticas:', error);
            return {
                totalAnomalies: 0,
                byType: {},
                bySeverity: {},
                recentAnomalies: []
            };
        }
    }
    /**
     * Calcula estadísticas de patrón
     */
    static calculatePatternStatistics(decision, allDecisions) {
        const occurrences = allDecisions.filter(d => d.typeId === decision.typeId).length;
        return {
            patternId: decision.typeId,
            frequency: occurrences,
            averageScore: decision.validationScore,
            standardDeviation: 0, // Simplificado
            lastSeen: Date.now(),
            totalOccurrences: occurrences
        };
    }
    /**
     * Calcula score de anomalía
     */
    static calculateAnomalyScore(stats, baseline) {
        const frequencyDiff = Math.abs(stats.frequency - baseline.frequency);
        const scoreDiff = Math.abs(stats.averageScore - baseline.averageScore);
        return (frequencyDiff / Math.max(baseline.frequency, 1)) + (scoreDiff * 2);
    }
    /**
     * Calcula desviación estándar
     */
    static calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Calcula score de consistencia
     * SSE-FIX-PURGE-AND-PATCH: Fixed false positives for new patterns without baseline
     */
    static calculateConsistencyScore(decisions, baseline) {
        if (decisions.length === 0)
            return 1;
        let totalConsistency = 0;
        for (const decision of decisions) {
            const baselineStats = baseline.find(b => b.patternId === decision.typeId);
            if (baselineStats) {
                // El patrón tiene historial, calcular consistencia
                const consistency = 1 - Math.abs(decision.validationScore - baselineStats.averageScore);
                totalConsistency += Math.max(0, consistency);
            }
            else {
                // SSE-FIX-PURGE-AND-PATCH: Patrón nuevo, sin historial. No es 'inconsistente'.
                // Asignar consistencia neutral (1.0) para evitar falsos positivos
                totalConsistency += 1.0;
            }
        }
        return totalConsistency / decisions.length;
    }
}
//# sourceMappingURL=behavioral-anomaly-detector.js.map