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

export class PrecisionJumpEngine {
  private readonly minWindow = 5;
  private readonly maxWindow = 50;
  private readonly defaultWindow = 20;

  /**
   * 📊 CALCULAR VOLATILIDAD del sistema
   */
  calculateVolatility(
    recentPatterns: Array<{
      beauty: number;
      convergenceTime: number;
      note: string;
    }>
  ): SystemVolatility {
    if (recentPatterns.length < 5) {
      return {
        beautyVariance: 0,
        convergenceVariance: 0,
        patternSwitchRate: 0,
        overallVolatility: 'medium',
      };
    }

    // 1. Varianza de beauty scores
    const beautyScores = recentPatterns.map(p => p.beauty);
    const avgBeauty = beautyScores.reduce((sum, b) => sum + b, 0) / beautyScores.length;
    const beautyVariance = beautyScores.reduce(
      (sum, b) => sum + Math.pow(b - avgBeauty, 2),
      0
    ) / beautyScores.length;

    // 2. Varianza de convergence times
    const times = recentPatterns.map(p => p.convergenceTime);
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const convergenceVariance = times.reduce(
      (sum, t) => sum + Math.pow(t - avgTime, 2),
      0
    ) / times.length;

    // 3. Tasa de cambio de patterns
    let switches = 0;
    for (let i = 1; i < recentPatterns.length; i++) {
      if (recentPatterns[i].note !== recentPatterns[i - 1].note) {
        switches++;
      }
    }
    const patternSwitchRate = switches / (recentPatterns.length - 1);

    // 4. Clasificar volatilidad overall
    const beautyVolatile = beautyVariance > 0.01; // threshold
    const timeVolatile = convergenceVariance > 1000000; // 1s variance
    const patternsVolatile = patternSwitchRate > 0.5; // >50% switches

    const volatileFactors = [beautyVolatile, timeVolatile, patternsVolatile].filter(Boolean).length;

    let overallVolatility: 'low' | 'medium' | 'high';
    if (volatileFactors === 0) overallVolatility = 'low';
    else if (volatileFactors === 1) overallVolatility = 'medium';
    else overallVolatility = 'high';

    return {
      beautyVariance,
      convergenceVariance,
      patternSwitchRate,
      overallVolatility,
    };
  }

  /**
   * 🎯 CALCULAR WINDOW SIZE óptima
   */
  calculateOptimalWindow(volatility: SystemVolatility): number {
    switch (volatility.overallVolatility) {
      case 'low':
        // Sistema estable → ventana grande para patterns profundos
        return this.maxWindow;

      case 'medium':
        // Volatilidad media → ventana default
        return this.defaultWindow;

      case 'high':
        // Alta volatilidad → ventana pequeña para reacción rápida
        return this.minWindow;
    }
  }

  /**
   * 📈 RECOMENDAR PRÓXIMO INSIGHT TIMING
   */
  recommendInsightTiming(
    currentExperience: number,
    volatility: SystemVolatility
  ): {
    nextInsightAt: number;
    reasoning: string;
  } {
    const window = this.calculateOptimalWindow(volatility);
    const nextInsightAt = Math.ceil(currentExperience / window) * window;

    const reasoning =
      volatility.overallVolatility === 'high'
        ? `High volatility - frequent insights (every ${window} exp)`
        : volatility.overallVolatility === 'low'
        ? `Low volatility - deep analysis (every ${window} exp)`
        : `Medium volatility - balanced (every ${window} exp)`;

    return {
      nextInsightAt,
      reasoning,
    };
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS de volatilidad
   */
  getVolatilityStats(volatility: SystemVolatility): {
    volatilityLevel: string;
    beautyStability: string;
    timeStability: string;
    patternStability: string;
    recommendedWindow: number;
  } {
    return {
      volatilityLevel: volatility.overallVolatility.toUpperCase(),
      beautyStability: volatility.beautyVariance < 0.005 ? 'HIGH' : volatility.beautyVariance < 0.01 ? 'MEDIUM' : 'LOW',
      timeStability: volatility.convergenceVariance < 500000 ? 'HIGH' : volatility.convergenceVariance < 1000000 ? 'MEDIUM' : 'LOW',
      patternStability: volatility.patternSwitchRate < 0.3 ? 'HIGH' : volatility.patternSwitchRate < 0.5 ? 'MEDIUM' : 'LOW',
      recommendedWindow: this.calculateOptimalWindow(volatility),
    };
  }
}


