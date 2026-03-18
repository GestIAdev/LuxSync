import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
export class PatternQuarantineSystem {
    static redis;
    static QUARANTINE_KEY = 'selene:evolution:quarantine';
    static QUARANTINE_THRESHOLD = 0.7;
    static MAX_QUARANTINE_TIME = 24 * 60 * 60 * 1000; // 24 horas
    static getRedis() {
        if (!this.redis) {
            this.redis = new Redis();
        }
        return this.redis;
    }
    /**
     * Evalúa riesgo de cuarentena para un patrón
     */
    static evaluateQuarantineRisk(decisionType, context) {
        const reasons = [];
        let riskLevel = 0;
        // Evaluar tasa de fallos
        if (context.failureRate > 0.5) {
            riskLevel += 0.3;
            reasons.push(`Alta tasa de fallos: ${(context.failureRate * 100).toFixed(1)}%`);
        }
        // Evaluar impacto en rendimiento
        if (context.performanceImpact < -0.2) {
            riskLevel += 0.25;
            reasons.push(`Impacto negativo en rendimiento: ${(context.performanceImpact * 100).toFixed(1)}%`);
        }
        // Evaluar score de anomalía
        if (context.anomalyScore > 0.8) {
            riskLevel += 0.2;
            reasons.push(`Score alto de anomalía: ${(context.anomalyScore * 100).toFixed(1)}%`);
        }
        // Evaluar feedback humano
        if (context.feedbackScore < 0.3) {
            riskLevel += 0.15;
            reasons.push(`Feedback humano bajo: ${(context.feedbackScore * 100).toFixed(1)}%`);
        }
        // Evaluar características del tipo de decisión
        if (decisionType.riskLevel > 0.8) {
            riskLevel += 0.1;
            reasons.push(`Tipo de decisión de alto riesgo: ${decisionType.name}`);
        }
        const shouldQuarantine = riskLevel >= this.QUARANTINE_THRESHOLD;
        const recommendedDuration = shouldQuarantine ? Math.min(this.MAX_QUARANTINE_TIME, riskLevel * 3600000) : 0;
        return {
            shouldQuarantine,
            riskLevel,
            reasons,
            recommendedDuration
        };
    }
    /**
     * Pone en cuarentena un patrón
     */
    static async quarantinePattern(patternId, decisionType, riskAssessment) {
        try {
            const quarantineEntry = {
                patternId,
                decisionType,
                quarantineReason: riskAssessment.reasons.join('; '),
                riskLevel: riskAssessment.riskLevel,
                quarantinedAt: Date.now(),
                releaseCriteria: [
                    'failureRate < 0.3',
                    'performanceImpact > -0.1',
                    'anomalyScore < 0.5',
                    'feedbackScore > 0.6'
                ],
                monitoringData: []
            };
            await this.getRedis().hset(this.QUARANTINE_KEY, patternId, JSON.stringify(quarantineEntry));
            console.log(`🛡️ [QUARANTINE] Patrón ${patternId} puesto en cuarentena. Razón: ${quarantineEntry.quarantineReason}`);
            return true;
        }
        catch (error) {
            console.error('❌ [QUARANTINE] Error al poner en cuarentena patrón:', error);
            return false;
        }
    }
    /**
     * Libera patrón de cuarentena
     */
    static async releaseFromQuarantine(patternId) {
        try {
            const exists = await this.getRedis().hexists(this.QUARANTINE_KEY, patternId);
            if (!exists) {
                console.warn(`⚠️ [QUARANTINE] Patrón ${patternId} no está en cuarentena`);
                return false;
            }
            await this.getRedis().hdel(this.QUARANTINE_KEY, patternId);
            console.log(`✅ [QUARANTINE] Patrón ${patternId} liberado de cuarentena`);
            return true;
        }
        catch (error) {
            console.error('❌ [QUARANTINE] Error al liberar patrón de cuarentena:', error);
            return false;
        }
    }
    /**
     * Obtiene estadísticas de cuarentena
     */
    static async getQuarantineStats() {
        try {
            const quarantined = await this.getRedis().hgetall(this.QUARANTINE_KEY);
            const entries = Object.values(quarantined).map(entry => JSON.parse(entry));
            const totalQuarantined = entries.length;
            const highRiskCount = entries.filter(entry => entry.riskLevel > 0.8).length;
            const averageRiskLevel = totalQuarantined > 0
                ? entries.reduce((sum, entry) => sum + entry.riskLevel, 0) / totalQuarantined
                : 0;
            const timestamps = entries.map(entry => entry.quarantinedAt);
            const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
            const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;
            return {
                totalQuarantined,
                highRiskCount,
                averageRiskLevel,
                oldestEntry,
                newestEntry
            };
        }
        catch (error) {
            console.error('❌ [QUARANTINE] Error obteniendo estadísticas:', error);
            return {
                totalQuarantined: 0,
                highRiskCount: 0,
                averageRiskLevel: 0,
                oldestEntry: 0,
                newestEntry: 0
            };
        }
    }
    /**
     * Limpia entradas expiradas de cuarentena
     */
    static async cleanupExpiredQuarantine() {
        try {
            const quarantined = await this.getRedis().hgetall(this.QUARANTINE_KEY);
            const now = Date.now();
            let cleaned = 0;
            for (const [patternId, entryStr] of Object.entries(quarantined)) {
                const entry = JSON.parse(entryStr);
                const age = now - entry.quarantinedAt;
                if (age > this.MAX_QUARANTINE_TIME) {
                    await this.getRedis().hdel(this.QUARANTINE_KEY, patternId);
                    cleaned++;
                    console.log(`🧹 [QUARANTINE] Patrón ${patternId} limpiado por expiración`);
                }
            }
            return cleaned;
        }
        catch (error) {
            console.error('❌ [QUARANTINE] Error limpiando cuarentena expirada:', error);
            return 0;
        }
    }
}
//# sourceMappingURL=pattern-quarantine-system.js.map