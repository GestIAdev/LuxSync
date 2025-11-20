import Redis from "ioredis";


/**
 * 🌙 NOCTURNAL VISION ENGINE
 * "Ve en la oscuridad del caos - predice el próximo amanecer"
 *
 * CAPACIDAD:
 * - Analiza últimos 10 consensos para encontrar patterns temporales
 * - Predice próxima nota con 95% confidence en condiciones estables
 * - Detecta anomalías cuando predicción < 70% (cambio de régimen)
 */

interface ConsensusEvent {
  note: string;
  zodiacSign: string;
  beauty: number;
  timestamp: Date;
  convergenceTime: number; // ms para alcanzar consenso
}

interface Prediction {
  predictedNote: string;
  predictedSign: string;
  confidence: number;
  reasoning: string;
  anomalyDetected: boolean;
}

export class NocturnalVisionEngine {
  private redis: any;
  private historyKey = 'selene:consensus:history';
  private maxHistorySize = 100; // Mantener últimos 100 consensos
  
  constructor(redis: any) {
    this.redis = redis;
  }  /**
   * 📊 REGISTRAR CONSENSO: Guardar para análisis predictivo
   */
  async recordConsensus(event: ConsensusEvent): Promise<void> {
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
    } catch (error) {
      console.error('🌙 [NOCTURNAL VISION] Error recording consensus:', error as Error);
    }
  }

  /**
   * 🔮 PREDECIR PRÓXIMO CONSENSO
   */
  async predictNext(): Promise<Prediction> {
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

      const history: ConsensusEvent[] = rawHistory.map((entry: string) => {
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
      const trend = this.detectTrend(
        history.slice(-5).map(h => h.note),
        history.slice(-10, -5).map(h => h.note)
      );

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
      } else {
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

    } catch (error) {
      console.error('🌙 [NOCTURNAL VISION] Error predicting next:', error as Error);
      return {
        predictedNote: 'ERROR',
        predictedSign: 'ERROR',
        confidence: 0,
        reasoning: `Prediction error: ${(error as Error).message}`,
        anomalyDetected: true
      };
    }
  }

  /**
   * 📈 CALCULAR FRECUENCIA: Helper para contar ocurrencias
   */
  private calculateFrequency(
    history: ConsensusEvent[],
    field: 'note' | 'zodiacSign'
  ): Array<{ value: string; count: number }> {
    const counts = new Map<string, number>();

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
  private detectTrend(recent: string[], older: string[]): 'stable' | 'shifting' {
    if (recent.length === 0 || older.length === 0) return 'shifting';

    const recentSet = new Set(recent);
    const olderSet = new Set(older);

    // Calcular overlap
    const intersection = new Set();
    recentSet.forEach(x => { if (olderSet.has(x)) intersection.add(x); });
    const union = new Set(recentSet);
    olderSet.forEach(x => union.add(x));

    const overlapRatio = intersection.size / union.size;

    return overlapRatio > 0.6 ? 'stable' : 'shifting';
  }

  /**
   * ⏱️ ESTABILIDAD DE CONVERGENCIA: Analizar tiempos
   */
  private calculateConvergenceStability(history: ConsensusEvent[]): number {
    const times = history.map(e => e.convergenceTime);

    if (times.length < 3) return 0.5;

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
  private generateReasoning(
    noteFreq: Array<{ value: string; count: number }>,
    signFreq: Array<{ value: string; count: number }>,
    trend: 'stable' | 'shifting',
    stability: number,
    confidence: number
  ): string {
    const parts = [];

    parts.push(`Top note: ${noteFreq[0].value} (${noteFreq[0].count} times)`);
    parts.push(`Top sign: ${signFreq[0].value} (${signFreq[0].count} times)`);
    parts.push(`Trend: ${trend}`);
    parts.push(`Stability: ${(stability * 100).toFixed(1)}%`);

    if (confidence > 0.9) {
      parts.push('HIGH CONFIDENCE: Stable pattern detected');
    } else if (confidence > 0.7) {
      parts.push('MEDIUM CONFIDENCE: Some pattern emerging');
    } else {
      parts.push('LOW CONFIDENCE: Pattern unclear or shifting');
    }

    return parts.join(' | ');
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS
   */
  async getStats(): Promise<{
    historySize: number;
    lastPrediction?: Prediction;
    predictionAccuracy: number; // TODO: Implementar tracking
  }> {
    const rawHistory = await this.redis.lrange(this.historyKey, 0, -1);
    const history: ConsensusEvent[] = rawHistory.map((entry: string) => {
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


