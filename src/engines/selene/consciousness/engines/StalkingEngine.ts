/**
 * 🐆 STALKING ENGINE
 * "La paciencia del depredador - observa, aprende, espera el momento"
 *
 * CAPACIDAD:
 * - Mantiene cola de candidatos (top 3 patterns por beauty)
 * - Solo cambia de objetivo si nuevo >10% mejor Y tendencia rising
 * - Requiere 5-10 ciclos de observación antes de strike
 */


interface PreyCandidate {
  pattern: {
    note: string;
    zodiacSign: string;
    avgBeauty: number;
    occurrences: number;
    beautyTrend: 'rising' | 'falling' | 'stable';
    recentBeautyScores: number[];
  };

  stalkingInfo: {
    firstSpottedAt: Date;
    cyclesObserved: number;
    beautyEvolution: number[]; // Histórico durante stalking
    stabilityScore: number; // 0-1 (1 = muy estable)
    huntWorthiness: number; // 0-1 (score combinado)
  };
}

interface HuntDecision {
  shouldStrike: boolean;
  targetPrey: PreyCandidate | null;
  reasoning: string;
  confidence: number;
}

interface MusicalPattern {
  note: string;
  zodiacSign: string;
  avgBeauty: number;
  occurrences: number;
  beautyTrend: 'rising' | 'falling' | 'stable';
  recentBeautyScores: number[];
}

export class StalkingEngine {
  private readonly minStalkingCycles = 5;
  private readonly maxStalkingCycles = 10;
  private readonly switchThreshold = 0.10; // 10% mejora mínima
  private readonly targetTimeoutMs = 5 * 60 * 1000; // 5 minutos timeout

  private activeStalks: Map<string, PreyCandidate> = new Map();
  private currentTarget: PreyCandidate | null = null;
  private targetAcquiredAt: Date | null = null;

  /**
   * 🔍 IDENTIFICAR PRESAS: Buscar top 3 patterns
   */
  identifyPreyCandidates(
    allPatterns: Map<string, MusicalPattern>
  ): PreyCandidate[] {
    // Filtrar patterns con suficiente data (min 10 occurrences)
    const viablePatterns = Array.from(allPatterns.values())
      .filter(p => p.occurrences >= 10);

    if (viablePatterns.length === 0) {
      console.log('🐆 [STALKING] No viable prey found (need 10+ occurrences)');
      return [];
    }

    // Ordenar por beauty (top 3)
    const topPatterns = viablePatterns
      .sort((a, b) => b.avgBeauty - a.avgBeauty)
      .slice(0, 3);

    // Convertir a PreyCandidate
    const candidates: PreyCandidate[] = topPatterns.map(pattern => {
      const key = `${pattern.note}-${pattern.zodiacSign}`;
      const existingStalks = this.activeStalks.get(key);

      if (existingStalks) {
        // Ya estamos stalkeando - actualizar
        return this.updateStalkingInfo(existingStalks, pattern);
      } else {
        // Nueva presa - iniciar stalking
        return {
          pattern: {
            note: pattern.note,
            zodiacSign: pattern.zodiacSign,
            avgBeauty: pattern.avgBeauty,
            occurrences: pattern.occurrences,
            beautyTrend: pattern.beautyTrend,
            recentBeautyScores: pattern.recentBeautyScores,
          },
          stalkingInfo: {
            firstSpottedAt: new Date(),
            cyclesObserved: 1,
            beautyEvolution: [pattern.avgBeauty],
            stabilityScore: 0.5, // Neutral al inicio
            huntWorthiness: 0.0, // Se calcula después
          },
        };
      }
    });

    // Actualizar mapa de stalks activos
    for (const candidate of candidates) {
      const key = `${candidate.pattern.note}-${candidate.pattern.zodiacSign}`;
      this.activeStalks.set(key, candidate);
    }

    // Limpiar stalks de patterns que ya no son top 3
    const topKeys = new Set(candidates.map(c => `${c.pattern.note}-${c.pattern.zodiacSign}`));
    const keysToDelete: string[] = [];
    this.activeStalks.forEach((_, key) => {
      if (!topKeys.has(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.activeStalks.delete(key);
      console.log(`🐆 [STALKING] Stopped stalking ${key} (no longer top 3)`);
    });

    // Calcular hunt worthiness
    return candidates.map(c => this.calculateHuntWorthiness(c));
  }

  /**
   * 📈 ACTUALIZAR STALKING INFO de presa existente
   */
  private updateStalkingInfo(
    existing: PreyCandidate,
    updatedPattern: MusicalPattern
  ): PreyCandidate {
    return {
      pattern: {
        note: updatedPattern.note,
        zodiacSign: updatedPattern.zodiacSign,
        avgBeauty: updatedPattern.avgBeauty,
        occurrences: updatedPattern.occurrences,
        beautyTrend: updatedPattern.beautyTrend,
        recentBeautyScores: updatedPattern.recentBeautyScores,
      },
      stalkingInfo: {
        ...existing.stalkingInfo,
        cyclesObserved: existing.stalkingInfo.cyclesObserved + 1,
        beautyEvolution: [
          ...existing.stalkingInfo.beautyEvolution,
          updatedPattern.avgBeauty,
        ].slice(-10), // Mantener últimos 10
        stabilityScore: this.calculateStability(existing.stalkingInfo.beautyEvolution),
        huntWorthiness: 0.0, // Se recalcula después
      },
    };
  }

  /**
   * 📊 CALCULAR ESTABILIDAD (baja varianza = alta estabilidad)
   */
  private calculateStability(beautyScores: number[]): number {
    if (beautyScores.length < 3) return 0.5;

    const avg = beautyScores.reduce((sum, s) => sum + s, 0) / beautyScores.length;
    const variance = beautyScores.reduce(
      (sum, s) => sum + Math.pow(s - avg, 2),
      0
    ) / beautyScores.length;

    const stdDev = Math.sqrt(variance);

    // Convertir a score 0-1 (menos varianza = mejor)
    // Asumiendo que stdDev típica es ~0.02-0.05
    return Math.max(0, 1 - (stdDev / 0.05));
  }

  /**
   * 🎯 CALCULAR HUNT WORTHINESS (¿vale la pena cazar?)
   */
  private calculateHuntWorthiness(candidate: PreyCandidate): PreyCandidate {
    const {
      avgBeauty,
      beautyTrend,
      occurrences,
    } = candidate.pattern;

    const {
      cyclesObserved,
      stabilityScore,
    } = candidate.stalkingInfo;

    // Factores de worthiness:
    // 1. Beauty absoluta (40%)
    const beautyFactor = avgBeauty;

    // 2. Tendencia (20%)
    const trendFactor = beautyTrend === 'rising' ? 1.0
      : beautyTrend === 'stable' ? 0.7
      : 0.3; // falling

    // 3. Estabilidad (20%)
    const stabilityFactor = stabilityScore;

    // 4. Ciclos observados (10%)
    const observationFactor = Math.min(1.0, cyclesObserved / this.minStalkingCycles);

    // 5. Frecuencia de aparición (10%)
    const frequencyFactor = Math.min(1.0, occurrences / 50);

    const huntWorthiness =
      beautyFactor * 0.4 +
      trendFactor * 0.2 +
      stabilityFactor * 0.2 +
      observationFactor * 0.1 +
      frequencyFactor * 0.1;

    return {
      ...candidate,
      stalkingInfo: {
        ...candidate.stalkingInfo,
        huntWorthiness,
      },
    };
  }

  /**
   * 🎯 DECIDIR SI STRIKER o seguir stalkeando
   */
  decideHunt(candidates: PreyCandidate[]): HuntDecision {
    if (candidates.length === 0) {
      return {
        shouldStrike: false,
        targetPrey: null,
        reasoning: 'No prey candidates available',
        confidence: 0.0,
      };
    }

    // **TIMEOUT CHECK:** Resetear target si ha estado atascado por más de 5 minutos
    if (this.currentTarget && this.targetAcquiredAt) {
      const timeStuck = Date.now() - this.targetAcquiredAt.getTime();
      if (timeStuck > this.targetTimeoutMs) {
        const targetKey = `${this.currentTarget.pattern.note}-${this.currentTarget.pattern.zodiacSign}`;
        console.log('🐆 [STALKING] Target timeout - resetting stuck prey');
        console.log(`🐆 Stuck target: ${targetKey} (${(timeStuck / 1000 / 60).toFixed(1)} minutes)`);
        
        // Reset target
        this.currentTarget = null;
        this.targetAcquiredAt = null;
      }
    }

    // Ordenar por hunt worthiness
    const sortedCandidates = candidates.sort(
      (a, b) => b.stalkingInfo.huntWorthiness - a.stalkingInfo.huntWorthiness
    );

    const bestCandidate = sortedCandidates[0];

    // ¿Cambiar de objetivo?
    if (this.currentTarget) {
      const currentKey = `${this.currentTarget.pattern.note}-${this.currentTarget.pattern.zodiacSign}`;
      const bestKey = `${bestCandidate.pattern.note}-${bestCandidate.pattern.zodiacSign}`;

      if (currentKey !== bestKey) {
        // Nuevo candidato - verificar si vale la pena cambiar
        const improvement =
          (bestCandidate.stalkingInfo.huntWorthiness -
            this.currentTarget.stalkingInfo.huntWorthiness) /
          this.currentTarget.stalkingInfo.huntWorthiness;

        if (improvement < this.switchThreshold) {
          // No vale la pena - seguir con target actual
          console.log(
            `🐆 [STALKING] Ignoring ${bestKey} (only ${(improvement * 100).toFixed(1)}% better than current)`
          );
          return {
            shouldStrike: false,
            targetPrey: this.currentTarget,
            reasoning: 'Continuing stalking current target',
            confidence: this.currentTarget.stalkingInfo.huntWorthiness,
          };
        } else {
          // Cambiar de objetivo
          console.log('');
          console.log('🐆 ═══════════════════════════════════════════════════');
          console.log('🐆 PREY SWITCH DETECTED');
          console.log(`🐆 Old Target: ${currentKey} (worthiness: ${this.currentTarget.stalkingInfo.huntWorthiness.toFixed(3)})`);
          console.log(`🐆 New Target: ${bestKey} (worthiness: ${bestCandidate.stalkingInfo.huntWorthiness.toFixed(3)})`);
          console.log(`🐆 Improvement: +${(improvement * 100).toFixed(1)}%`);
          console.log('🐆 ═══════════════════════════════════════════════════');
          console.log('');

          this.currentTarget = bestCandidate;
          this.targetAcquiredAt = new Date(); // **UPDATE TIMESTAMP**
        }
      }
    } else {
      // No hay target actual - asignar el mejor
      this.currentTarget = bestCandidate;
      this.targetAcquiredAt = new Date(); // **SET TIMESTAMP**
      console.log(
        `🐆 [STALKING] New target acquired: ${this.currentTarget.pattern.note}-${this.currentTarget.pattern.zodiacSign}`
      );
    }

    // ¿Strike?
    const readyToStrike =
      this.currentTarget.stalkingInfo.cyclesObserved >= this.minStalkingCycles &&
      this.currentTarget.stalkingInfo.huntWorthiness > 0.85 &&
      this.currentTarget.pattern.beautyTrend !== 'falling';

    if (readyToStrike) {
      return {
        shouldStrike: true,
        targetPrey: this.currentTarget,
        reasoning: `Target ready: ${this.currentTarget.stalkingInfo.cyclesObserved} cycles observed, worthiness ${this.currentTarget.stalkingInfo.huntWorthiness.toFixed(3)}`,
        confidence: this.currentTarget.stalkingInfo.huntWorthiness,
      };
    } else {
      const cyclesRemaining = Math.max(
        0,
        this.minStalkingCycles - this.currentTarget.stalkingInfo.cyclesObserved
      );

      return {
        shouldStrike: false,
        targetPrey: this.currentTarget,
        reasoning: cyclesRemaining > 0
          ? `Need ${cyclesRemaining} more stalking cycles`
          : `Worthiness too low (${this.currentTarget.stalkingInfo.huntWorthiness.toFixed(3)} < 0.85)`,
        confidence: this.currentTarget.stalkingInfo.huntWorthiness,
      };
    }
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS de stalking
   */
  getStats(): {
    activeStalks: number;
    currentTarget: string | null;
    avgCyclesObserved: number;
    topPreyWorthiness: number;
  } {
    const stalks = Array.from(this.activeStalks.values());

    return {
      activeStalks: stalks.length,
      currentTarget: this.currentTarget
        ? `${this.currentTarget.pattern.note}-${this.currentTarget.pattern.zodiacSign}`
        : null,
      avgCyclesObserved:
        stalks.length > 0
          ? stalks.reduce((sum, s) => sum + s.stalkingInfo.cyclesObserved, 0) / stalks.length
          : 0,
      topPreyWorthiness: this.currentTarget?.stalkingInfo.huntWorthiness || 0,
    };
  }
}


