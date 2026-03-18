export class PreyRecognitionEngine {
    redis;
    huntKeyPrefix = 'selene:consciousness:hunts:';
    profileKeyPrefix = 'selene:consciousness:prey-profiles:';
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * 💾 REGISTRAR HUNT en Redis
     */
    async recordHunt(hunt) {
        try {
            const huntKey = `${this.huntKeyPrefix}${hunt.huntId}`;
            // Guardar hunt completa
            await this.redis.hmset(huntKey, {
                targetPattern: hunt.targetPattern,
                preStrikeBeauty: hunt.preStrikeBeauty.toString(),
                preStrikeTrend: hunt.preStrikeTrend,
                preStrikeConsonance: hunt.preStrikeConsonance.toString(),
                clusterHealth: hunt.clusterHealth.toString(),
                postStrikeBeauty: hunt.postStrikeBeauty.toString(),
                improvement: hunt.improvement.toString(),
                success: hunt.success.toString(),
                stalkingCycles: hunt.stalkingCycles.toString(),
                timestamp: hunt.timestamp.toISOString(),
                generation: hunt.generation.toString(),
            });
            // TTL: 60 días
            await this.redis.expire(huntKey, 60 * 24 * 60 * 60);
            // Actualizar profile de la presa
            await this.updatePreyProfile(hunt);
            console.log(`🧠 [PREY-RECOGNITION] Hunt recorded: ${hunt.huntId}`);
        }
        catch (error) {
            console.error('🧠 [PREY-RECORD-ERROR]:', error);
        }
    }
    /**
     * 📊 ACTUALIZAR PROFILE de presa
     */
    async updatePreyProfile(hunt) {
        const profileKey = `${this.profileKeyPrefix}${hunt.targetPattern}`;
        try {
            // Incrementar contadores
            await this.redis.hincrby(profileKey, 'totalHunts', 1);
            if (hunt.success) {
                await this.redis.hincrby(profileKey, 'successfulHunts', 1);
                // Acumular métricas de éxito
                const currentAvgBeauty = parseFloat((await this.redis.hget(profileKey, 'avgBeautyWhenSuccess')) || '0');
                const currentCount = parseInt((await this.redis.hget(profileKey, 'successfulHunts')) || '1');
                // Promedio móvil
                const newAvgBeauty = (currentAvgBeauty * (currentCount - 1) + hunt.preStrikeBeauty) / currentCount;
                await this.redis.hset(profileKey, 'avgBeautyWhenSuccess', newAvgBeauty.toString());
                // Similar para consonance y cluster health...
                const currentAvgConsonance = parseFloat((await this.redis.hget(profileKey, 'avgConsonanceWhenSuccess')) || '0');
                const newAvgConsonance = (currentAvgConsonance * (currentCount - 1) + hunt.preStrikeConsonance) / currentCount;
                await this.redis.hset(profileKey, 'avgConsonanceWhenSuccess', newAvgConsonance.toString());
                const currentAvgHealth = parseFloat((await this.redis.hget(profileKey, 'avgClusterHealthWhenSuccess')) || '0');
                const newAvgHealth = (currentAvgHealth * (currentCount - 1) + hunt.clusterHealth) / currentCount;
                await this.redis.hset(profileKey, 'avgClusterHealthWhenSuccess', newAvgHealth.toString());
            }
            // Actualizar best improvement
            const currentBest = parseFloat((await this.redis.hget(profileKey, 'bestImprovement')) || '0');
            if (hunt.improvement > currentBest) {
                await this.redis.hset(profileKey, 'bestImprovement', hunt.improvement.toString());
            }
            // TTL: 60 días
            await this.redis.expire(profileKey, 60 * 24 * 60 * 60);
        }
        catch (error) {
            console.error('🧠 [PROFILE-UPDATE-ERROR]:', error);
        }
    }
    /**
     * 📖 CARGAR PROFILE de presa
     */
    async loadPreyProfile(patternKey) {
        const profileKey = `${this.profileKeyPrefix}${patternKey}`;
        try {
            const data = await this.redis.hgetall(profileKey);
            if (!data || Object.keys(data).length === 0) {
                return null;
            }
            const totalHunts = parseInt(data.totalHunts || '0');
            const successfulHunts = parseInt(data.successfulHunts || '0');
            const successRate = totalHunts > 0 ? successfulHunts / totalHunts : 0;
            // Calcular difficulty
            let difficulty;
            if (successRate > 0.7)
                difficulty = 'easy';
            else if (successRate > 0.4)
                difficulty = 'medium';
            else
                difficulty = 'hard';
            return {
                patternKey,
                totalHunts,
                successfulHunts,
                successRate,
                avgImprovement: parseFloat(data.avgImprovement || '0'),
                bestImprovement: parseFloat(data.bestImprovement || '0'),
                optimalConditions: {
                    avgBeautyWhenSuccess: parseFloat(data.avgBeautyWhenSuccess || '0'),
                    avgConsonanceWhenSuccess: parseFloat(data.avgConsonanceWhenSuccess || '0'),
                    avgClusterHealthWhenSuccess: parseFloat(data.avgClusterHealthWhenSuccess || '0'),
                },
                difficulty,
            };
        }
        catch (error) {
            console.error('🧠 [PROFILE-LOAD-ERROR]:', error);
            return null;
        }
    }
    /**
     * 🎯 RECOMENDAR MEJOR PRESA basado en histórico
     */
    async recommendBestPrey(candidates) {
        // Cargar profiles de todos los candidatos
        const profiles = await Promise.all(candidates.map(c => this.loadPreyProfile(c.patternKey)));
        // Filtrar nulls
        const validProfiles = profiles.filter(p => p !== null);
        if (validProfiles.length === 0) {
            return {
                recommended: candidates[0].patternKey,
                reasoning: 'No historical data - choosing highest beauty',
                confidence: 0.5,
            };
        }
        // Rankear por success rate + avg improvement
        const ranked = validProfiles.map(profile => {
            const candidate = candidates.find(c => c.patternKey === profile.patternKey);
            // Score combinado
            const score = profile.successRate * 0.5 +
                profile.avgImprovement * 0.3 +
                (candidate.currentBeauty / 1.0) * 0.2;
            return {
                profile,
                score,
            };
        });
        ranked.sort((a, b) => b.score - a.score);
        const best = ranked[0];
        return {
            recommended: best.profile.patternKey,
            reasoning: `Success rate: ${(best.profile.successRate * 100).toFixed(1)}%, Avg improvement: ${(best.profile.avgImprovement * 100).toFixed(2)}%`,
            confidence: best.score,
        };
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS generales
     */
    async getStats() {
        try {
            // Contar hunts totales
            const huntKeys = await this.redis.keys(`${this.huntKeyPrefix}*`);
            // Contar prey profiles
            const profileKeys = await this.redis.keys(`${this.profileKeyPrefix}*`);
            // Cargar todos los profiles
            const profiles = await Promise.all(profileKeys.map((key) => {
                const patternKey = key.replace(this.profileKeyPrefix, '');
                return this.loadPreyProfile(patternKey);
            }));
            const validProfiles = profiles.filter((p) => p !== null);
            if (validProfiles.length === 0) {
                return {
                    totalHuntsRecorded: 0,
                    uniquePreyHunted: 0,
                    overallSuccessRate: 0,
                    easiestPrey: null,
                    hardestPrey: null,
                };
            }
            // Calcular success rate overall
            const totalSuccess = validProfiles.reduce((sum, p) => sum + p.successfulHunts, 0);
            const totalHunts = validProfiles.reduce((sum, p) => sum + p.totalHunts, 0);
            const overallSuccessRate = totalSuccess / totalHunts;
            // Encontrar easiest/hardest
            const sortedBySuccess = validProfiles.sort((a, b) => b.successRate - a.successRate);
            const easiestPrey = sortedBySuccess[0];
            const hardestPrey = sortedBySuccess[sortedBySuccess.length - 1];
            return {
                totalHuntsRecorded: huntKeys.length,
                uniquePreyHunted: validProfiles.length,
                overallSuccessRate,
                easiestPrey,
                hardestPrey,
            };
        }
        catch (error) {
            console.error('🧠 [STATS-ERROR]:', error);
            return {
                totalHuntsRecorded: 0,
                uniquePreyHunted: 0,
                overallSuccessRate: 0,
                easiestPrey: null,
                hardestPrey: null,
            };
        }
    }
}
//# sourceMappingURL=PreyRecognitionEngine.js.map