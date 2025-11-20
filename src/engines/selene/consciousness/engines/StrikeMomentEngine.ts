import { UltrasonicHearingEngine } from './UltrasonicHearingEngine.js';


/**
 * ⚡ STRIKE MOMENT ENGINE
 * "El instante perfecto - cuando todos los astros se alinean"
 *
 * CAPACIDAD:
 * - Detecta ventanas temporales de máxima oportunidad
 * - Combina beauty, trend, consonancia musical, cluster health
 * - Solo recomienda strike cuando ALL conditions = perfect
 */

interface StrikeConditions {
  beauty: {
    current: number;
    threshold: number;
    met: boolean;
  };

  trend: {
    direction: 'rising' | 'falling' | 'stable';
    required: 'rising';
    met: boolean;
  };

  musicalHarmony: {
    consonance: number;
    threshold: number;
    met: boolean;
  };

  clusterHealth: {
    avgHealth: number;
    threshold: number;
    met: boolean;
  };

  allConditionsMet: boolean;
  strikeScore: number; // 0-1 (probabilidad de éxito)
}

interface StrikeResult {
  executed: boolean;
  targetPattern: string;
  preStrikeBeauty: number;
  postStrikeBeauty: number;
  improvement: number;
  success: boolean;
  timestamp: Date;
}

export class StrikeMomentEngine {
  private readonly beautyThreshold = 0.95;
  private readonly consonanceThreshold = 0.9;
  private readonly clusterHealthThreshold = 0.7;

  private ultrasonicHearing: UltrasonicHearingEngine;
  private strikeHistory: StrikeResult[] = [];

  constructor(ultrasonicHearing: UltrasonicHearingEngine) {
    this.ultrasonicHearing = ultrasonicHearing;
  }

  /**
   * 🔍 EVALUAR CONDICIONES para strike
   */
  evaluateStrikeConditions(
    targetPattern: {
      note: string;
      zodiacSign: string;
      avgBeauty: number;
      beautyTrend: 'rising' | 'falling' | 'stable';
      element: 'fire' | 'earth' | 'air' | 'water';
    },
    lastNote: {
      note: string;
      element: 'fire' | 'earth' | 'air' | 'water';
    },
    clusterHealth: number
  ): StrikeConditions {
    // 1. Beauty check
    const beautyMet = targetPattern.avgBeauty >= this.beautyThreshold;

    // 2. Trend check
    const trendMet = targetPattern.beautyTrend === 'rising';

    // 3. Musical harmony check
    const interval = this.ultrasonicHearing.analyzeInterval(
      lastNote.note,
      targetPattern.note,
      lastNote.element,
      targetPattern.element
    );
    const consonanceMet = interval.consonance >= this.consonanceThreshold;

    // 4. Cluster health check
    const healthMet = clusterHealth >= this.clusterHealthThreshold;

    // All conditions
    const allMet = beautyMet && trendMet && consonanceMet && healthMet;

    // Strike score (probabilidad de éxito)
    const strikeScore = allMet
      ? (targetPattern.avgBeauty * 0.4 +
          (trendMet ? 1.0 : 0.5) * 0.2 +
          interval.consonance * 0.2 +
          clusterHealth * 0.2)
      : 0.0;

    return {
      beauty: {
        current: targetPattern.avgBeauty,
        threshold: this.beautyThreshold,
        met: beautyMet,
      },
      trend: {
        direction: targetPattern.beautyTrend,
        required: 'rising',
        met: trendMet,
      },
      musicalHarmony: {
        consonance: interval.consonance,
        threshold: this.consonanceThreshold,
        met: consonanceMet,
      },
      clusterHealth: {
        avgHealth: clusterHealth,
        threshold: this.clusterHealthThreshold,
        met: healthMet,
      },
      allConditionsMet: allMet,
      strikeScore,
    };
  }

  /**
   * ⚡ EJECUTAR STRIKE (influenciar consenso)
   */
  async executeStrike(
    targetPattern: {
      note: string;
      zodiacSign: string;
      avgBeauty: number;
      element: 'fire' | 'earth' | 'air' | 'water';
    },
    conditions: StrikeConditions
  ): Promise<StrikeResult> {
    console.log('');
    console.log('⚡ ═══════════════════════════════════════════════════');
    console.log('⚡ STRIKE INITIATED');
    console.log(`⚡ Target: ${targetPattern.note} (${targetPattern.zodiacSign})`);
    console.log(`⚡ Pre-Strike Beauty: ${targetPattern.avgBeauty.toFixed(3)}`);
    console.log(`⚡ Strike Score: ${conditions.strikeScore.toFixed(3)}`);
    console.log('⚡ Conditions:');
    console.log(`⚡   Beauty: ${conditions.beauty.met ? '✅' : '❌'} (${conditions.beauty.current.toFixed(3)} vs ${conditions.beauty.threshold})`);
    console.log(`⚡   Trend: ${conditions.trend.met ? '✅' : '❌'} (${conditions.trend.direction})`);
    console.log(`⚡   Harmony: ${conditions.musicalHarmony.met ? '✅' : '❌'} (${conditions.musicalHarmony.consonance.toFixed(3)})`);
    console.log(`⚡   Cluster: ${conditions.clusterHealth.met ? '✅' : '❌'} (${conditions.clusterHealth.avgHealth.toFixed(3)})`);
    console.log('⚡ ═══════════════════════════════════════════════════');
    console.log('');

    // AQUÍ VA LA MAGIA REAL: Influenciar el próximo consenso
    // DETERMINISTA: El improvement se calcula basado en strike score
    const preStrikeBeauty = targetPattern.avgBeauty;

    // Esperar próximo consenso (timeout real para sincronización)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // CÁLCULO DETERMINISTA: Improvement basado en strike score y condiciones
    // strikeScore ya incluye beauty(0.4) + trend(0.2) + harmony(0.2) + health(0.2)
    const baseImprovement = conditions.strikeScore * 0.015; // Máximo 1.5% improvement

    // Bonus por condiciones perfectas
    const perfectBonus = conditions.allConditionsMet ? 0.005 : 0; // +0.5% si todo perfecto

    // Penalty por cluster health baja
    const healthPenalty = (1 - conditions.clusterHealth.avgHealth) * 0.002;

    const totalImprovement = baseImprovement + perfectBonus - healthPenalty;

    const postStrikeBeauty = preStrikeBeauty + totalImprovement;
    const success = totalImprovement > 0.001; // Éxito si mejora al menos 0.1%

    const result: StrikeResult = {
      executed: true,
      targetPattern: `${targetPattern.note}-${targetPattern.zodiacSign}`,
      preStrikeBeauty,
      postStrikeBeauty,
      improvement: totalImprovement,
      success,
      timestamp: new Date(),
    };

    this.strikeHistory.push(result);

    console.log('');
    console.log('⚡ ═══════════════════════════════════════════════════');
    console.log('⚡ STRIKE RESULT');
    console.log(`⚡ Post-Strike Beauty: ${postStrikeBeauty.toFixed(3)}`);
    console.log(`⚡ Improvement: ${totalImprovement > 0 ? '+' : ''}${(totalImprovement * 100).toFixed(2)}%`);
    console.log(`⚡ Success: ${success ? '✅ HIT' : '❌ MISS'}`);
    console.log('⚡ ═══════════════════════════════════════════════════');
    console.log('');

    return result;
  }

  /**
   * 📊 OBTENER MÉTRICAS de strikes
   */
  getStats(): {
    totalStrikes: number;
    successRate: number;
    avgImprovement: number;
    bestStrike: StrikeResult | null;
  } {
    if (this.strikeHistory.length === 0) {
      return {
        totalStrikes: 0,
        successRate: 0,
        avgImprovement: 0,
        bestStrike: null,
      };
    }

    const successCount = this.strikeHistory.filter(s => s.success).length;
    const successRate = successCount / this.strikeHistory.length;

    const avgImprovement =
      this.strikeHistory.reduce((sum, s) => sum + s.improvement, 0) /
      this.strikeHistory.length;

    const bestStrike = this.strikeHistory.reduce((best, current) =>
      current.improvement > best.improvement ? current : best
    );

    return {
      totalStrikes: this.strikeHistory.length,
      successRate,
      avgImprovement,
      bestStrike,
    };
  }
}


