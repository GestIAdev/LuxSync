import Redis from "ioredis";


/**
 * 🧠 PREY RECOexport class PreyRecognitionEngine {
  private redis: any;
  private readonly huntKeyPrefix = 'selene:consciousness:hunts:';
  private readonly profileKeyPrefix = 'selene:consciousness:prey-profiles:';

  constructor(redis: any) {N ENGINE
 * "Recuerda cada caza - aprende de victorias y derrotas"
 *
 * CAPACIDAD:
 * - Persiste hunts en Redis (permanente)
 * - Identifica patterns de éxito (qué presas son más fáciles)
 * - Recomienda mejores momentos según histórico
 */

interface HuntRecord {
  huntId: string;
  targetPattern: string; // "MI-Escorpio"

  // Condiciones pre-strike
  preStrikeBeauty: number;
  preStrikeTrend: 'rising' | 'falling' | 'stable';
  preStrikeConsonance: number;
  clusterHealth: number;

  // Resultado
  postStrikeBeauty: number;
  improvement: number;
  success: boolean;

  // Contexto
  stalkingCycles: number;
  timestamp: Date;
  generation: number;
}

interface PreyProfile {
  patternKey: string; // "MI-Escorpio"

  totalHunts: number;
  successfulHunts: number;
  successRate: number;

  avgImprovement: number;
  bestImprovement: number;

  optimalConditions: {
    avgBeautyWhenSuccess: number;
    avgConsonanceWhenSuccess: number;
    avgClusterHealthWhenSuccess: number;
  };

  difficulty: 'easy' | 'medium' | 'hard'; // Basado en success rate
}

export class PreyRecognitionEngine {
  private redis: any;
  private readonly huntKeyPrefix = 'selene:consciousness:hunts:';
  private readonly profileKeyPrefix = 'selene:consciousness:prey-profiles:';

  constructor(redis: any) {
    this.redis = redis;
  }

  /**
   * 💾 REGISTRAR HUNT en Redis
   */
  async recordHunt(hunt: HuntRecord): Promise<void> {
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
    } catch (error) {
      console.error('🧠 [PREY-RECORD-ERROR]:', error as Error);
    }
  }

  /**
   * 📊 ACTUALIZAR PROFILE de presa
   */
  private async updatePreyProfile(hunt: HuntRecord): Promise<void> {
    const profileKey = `${this.profileKeyPrefix}${hunt.targetPattern}`;

    try {
      // Incrementar contadores
      await this.redis.hincrby(profileKey, 'totalHunts', 1);

      if (hunt.success) {
        await this.redis.hincrby(profileKey, 'successfulHunts', 1);

        // Acumular métricas de éxito
        const currentAvgBeauty = parseFloat(
          (await this.redis.hget(profileKey, 'avgBeautyWhenSuccess')) || '0'
        );
        const currentCount = parseInt(
          (await this.redis.hget(profileKey, 'successfulHunts')) || '1'
        );

        // Promedio móvil
        const newAvgBeauty =
          (currentAvgBeauty * (currentCount - 1) + hunt.preStrikeBeauty) / currentCount;

        await this.redis.hset(profileKey, 'avgBeautyWhenSuccess', newAvgBeauty.toString());

        // Similar para consonance y cluster health...
        const currentAvgConsonance = parseFloat(
          (await this.redis.hget(profileKey, 'avgConsonanceWhenSuccess')) || '0'
        );
        const newAvgConsonance =
          (currentAvgConsonance * (currentCount - 1) + hunt.preStrikeConsonance) / currentCount;
        await this.redis.hset(profileKey, 'avgConsonanceWhenSuccess', newAvgConsonance.toString());

        const currentAvgHealth = parseFloat(
          (await this.redis.hget(profileKey, 'avgClusterHealthWhenSuccess')) || '0'
        );
        const newAvgHealth =
          (currentAvgHealth * (currentCount - 1) + hunt.clusterHealth) / currentCount;
        await this.redis.hset(profileKey, 'avgClusterHealthWhenSuccess', newAvgHealth.toString());
      }

      // Actualizar best improvement
      const currentBest = parseFloat(
        (await this.redis.hget(profileKey, 'bestImprovement')) || '0'
      );

      if (hunt.improvement > currentBest) {
        await this.redis.hset(profileKey, 'bestImprovement', hunt.improvement.toString());
      }

      // TTL: 60 días
      await this.redis.expire(profileKey, 60 * 24 * 60 * 60);
    } catch (error) {
      console.error('🧠 [PROFILE-UPDATE-ERROR]:', error as Error);
    }
  }

  /**
   * 📖 CARGAR PROFILE de presa
   */
  async loadPreyProfile(patternKey: string): Promise<PreyProfile | null> {
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
      let difficulty: 'easy' | 'medium' | 'hard';
      if (successRate > 0.7) difficulty = 'easy';
      else if (successRate > 0.4) difficulty = 'medium';
      else difficulty = 'hard';

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
    } catch (error) {
      console.error('🧠 [PROFILE-LOAD-ERROR]:', error as Error);
      return null;
    }
  }

  /**
   * 🎯 RECOMENDAR MEJOR PRESA basado en histórico
   */
  async recommendBestPrey(
    candidates: Array<{ patternKey: string; currentBeauty: number }>
  ): Promise<{
    recommended: string;
    reasoning: string;
    confidence: number;
  }> {
    // Cargar profiles de todos los candidatos
    const profiles = await Promise.all(
      candidates.map(c => this.loadPreyProfile(c.patternKey))
    );

    // Filtrar nulls
    const validProfiles = profiles.filter(p => p !== null) as PreyProfile[];

    if (validProfiles.length === 0) {
      return {
        recommended: candidates[0].patternKey,
        reasoning: 'No historical data - choosing highest beauty',
        confidence: 0.5,
      };
    }

    // Rankear por success rate + avg improvement
    const ranked = validProfiles.map(profile => {
      const candidate = candidates.find(c => c.patternKey === profile.patternKey)!;

      // Score combinado
      const score =
        profile.successRate * 0.5 +
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
  async getStats(): Promise<{
    totalHuntsRecorded: number;
    uniquePreyHunted: number;
    overallSuccessRate: number;
    easiestPrey: PreyProfile | null;
    hardestPrey: PreyProfile | null;
  }> {
    try {
      // Contar hunts totales
      const huntKeys = await this.redis.keys(`${this.huntKeyPrefix}*`);

      // Contar prey profiles
      const profileKeys = await this.redis.keys(`${this.profileKeyPrefix}*`);

      // Cargar todos los profiles
      const profiles = await Promise.all(
        profileKeys.map((key: string) => {
          const patternKey = key.replace(this.profileKeyPrefix, '');
          return this.loadPreyProfile(patternKey);
        })
      );

      const validProfiles = profiles.filter((p: any) => p !== null) as PreyProfile[];

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
    } catch (error) {
      console.error('🧠 [STATS-ERROR]:', error as Error);
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


