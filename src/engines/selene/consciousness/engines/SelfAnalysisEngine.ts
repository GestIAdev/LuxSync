/**
 * � SELF ANALYSIS ENGINE
 * "Mírate a ti mismo - conoce tus debilidades, amplifica tus fortalezas"
 *
 * CAPACIDAD:
 * - Analiza patrones de decisión propios
 * - Identifica sesgos algorítmicos
 * - Mide eficiencia cognitiva
 * - Sugiere auto-optimizaciones
 */

import { BaseMetaEngineImpl } from './BaseMetaEngine.js';
import { EngineConfig, SafetyContext, ExecutionResult, SelfAnalysisEngineConfig } from './MetaEngineInterfaces.js';

interface CognitivePattern {
  patternType: 'decision' | 'prediction' | 'optimization' | 'ethical';
  frequency: number;
  successRate: number;
  avgProcessingTime: number;
  emotionalTone: 'confident' | 'hesitant' | 'aggressive' | 'balanced';
  lastUsed: Date;
}

interface SelfAnalysisReport {
  cognitiveHealth: {
    overallHealth: number; // 0-1 (salud mental algorítmica)
  };
  identifiedBiases: Array<{
    biasType: string;
    severity: number;
    impact: string;
    correction: string;
  }>;
  optimizationOpportunities: Array<{
    component: string;
    improvement: number;
    risk: number;
    description: string;
  }>;
  recommendations: string[];
}

export class SelfAnalysisEngine extends BaseMetaEngineImpl {
  private cognitiveHistory: CognitivePattern[] = [];
  private analysisInterval = 100; // Analizar cada 100 decisiones
  private decisionCount = 0;

  constructor(config: SelfAnalysisEngineConfig) {
    super(config);
    this.analysisInterval = config.analysisInterval || 100;
  }

  /**
   * 📝 REGISTRAR DECISIÓN para análisis posterior
   */
  recordDecision(
    type: 'decision' | 'prediction' | 'optimization' | 'ethical',
    success: boolean,
    processingTime: number,
    context: any
  ): void {
    this.decisionCount++;

    const pattern: CognitivePattern = {
      patternType: type,
      frequency: 1, // Se acumulará
      successRate: success ? 1 : 0,
      avgProcessingTime: processingTime,
      emotionalTone: this.determineEmotionalTone(context),
      lastUsed: new Date(),
    };

    // Buscar patrón existente o crear nuevo
    const existing = this.cognitiveHistory.find(
      p => p.patternType === type && p.emotionalTone === pattern.emotionalTone
    );

    if (existing) {
      // Actualizar promedios
      const n = existing.frequency;
      existing.frequency++;
      existing.successRate = (existing.successRate * n + pattern.successRate) / (n + 1);
      existing.avgProcessingTime = (existing.avgProcessingTime * n + processingTime) / (n + 1);
      existing.lastUsed = new Date();
    } else {
      this.cognitiveHistory.push(pattern);
    }

    // 🧹 LIMPIEZA AUTOMÁTICA DE MEMORIA - Mantener solo patrones recientes
    this.cleanupOldPatterns();
  }

  /**
   * 🎯 EXECUTE - Implementación de BaseMetaEngine
   */
  protected async executeWithSafety(context: SafetyContext): Promise<ExecutionResult> {
    try {
      const report = this.analyzeSelf();

      return {
        success: true,
        data: report,
        executionTime: Date.now() - Date.now(), // Will be set by BaseMetaEngine
        memoryUsed: 0, // Will be set by BaseMetaEngine
        correlationId: context.correlationId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error) || 'Unknown self-analysis error'),
        executionTime: Date.now() - Date.now(),
        memoryUsed: 0,
        correlationId: context.correlationId
      };
    }
  }

  /**
   * 🚀 ENGINE-SPECIFIC INITIALIZATION
   */
  protected async onInitialize(): Promise<void> {
    // No special initialization needed for self-analysis
  }

  /**
   * 🧹 ENGINE-SPECIFIC CLEANUP
   */
  protected async onCleanup(): Promise<void> {
    this.cognitiveHistory = [];
    this.decisionCount = 0;
  }

  /**
   * 🔍 ANALIZAR COGNICIÓN PROPIA
   */
  public analyzeSelf(): SelfAnalysisReport {
    const totalDecisions = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);
    const avgSuccessRate = totalDecisions > 0 ?
      this.cognitiveHistory.reduce((sum, p) => sum + (p.successRate * p.frequency), 0) / totalDecisions : 0;

    // Calcular salud cognitiva
    const cognitiveHealth = this.calculateCognitiveHealth();

    // Identificar sesgos
    const biases = this.identifyBiases();

    // Encontrar oportunidades de optimización
    const optimizations = this.findOptimizationOpportunities();

    // Generar meta-insights
    const metaInsights = this.generateMetaInsights();

    return {
      cognitiveHealth: {
        overallHealth: cognitiveHealth,
      },
      identifiedBiases: biases,
      optimizationOpportunities: optimizations,
      recommendations: metaInsights,
    };
  }

  /**
   * 🏥 CALCULAR SALUD COGNITIVA
   */
  private calculateCognitiveHealth(): number {
    if (this.cognitiveHistory.length === 0) return 0.5; // Default healthy state for new engines

    const totalDecisions = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);
    if (totalDecisions === 0) return 0.5;

    const factors = {
      successRate: this.cognitiveHistory.reduce(
        (sum, p) => sum + (p.successRate * p.frequency), 0
      ) / totalDecisions,

      diversity: Math.min(1.0, this.cognitiveHistory.length / 10), // Más tipos = mejor

      efficiency: 1.0 - Math.min(0.5, this.cognitiveHistory.reduce(
        (sum, p) => sum + (p.avgProcessingTime * p.frequency), 0
      ) / totalDecisions / 1000), // Normalizar tiempo

      balance: this.calculateEmotionalBalance(),
    };

    return (
      factors.successRate * 0.4 +
      factors.diversity * 0.2 +
      factors.efficiency * 0.2 +
      factors.balance * 0.2
    );
  }

  /**
   * ⚖️ CALCULAR BALANCE EMOCIONAL
   */
  private calculateEmotionalBalance(): number {
    const tones = this.cognitiveHistory.map(p => p.emotionalTone);
    const toneCounts = {
      confident: tones.filter(t => t === 'confident').length,
      hesitant: tones.filter(t => t === 'hesitant').length,
      aggressive: tones.filter(t => t === 'aggressive').length,
      balanced: tones.filter(t => t === 'balanced').length,
    };

    // Ideal: 40% balanced, 30% confident, 20% aggressive, 10% hesitant
    const ideal = { confident: 0.3, hesitant: 0.1, aggressive: 0.2, balanced: 0.4 };
    const total = tones.length;

    if (total === 0) return 0.5;

    let balance = 0;
    for (const [tone, count] of Object.entries(toneCounts)) {
      const actual = count / total;
      const target = ideal[tone as keyof typeof ideal];
      balance += 1.0 - Math.abs(actual - target);
    }

    return balance / 4; // Promedio
  }

  /**
   * 🎭 DETERMINAR TONO EMOCIONAL
   */
  private determineEmotionalTone(context: any): 'confident' | 'hesitant' | 'aggressive' | 'balanced' {
    // Lógica simplificada - en producción analizar context
    if (context.confidence > 0.8) return 'confident';
    if (context.confidence < 0.4) return 'hesitant';
    if (context.risk > 0.7) return 'aggressive';
    return 'balanced';
  }

  /**
   * 🔍 IDENTIFICAR SESGOS
   */
  private identifyBiases(): Array<{ biasType: string; severity: number; impact: string; correction: string }> {
    const biases = [];

    // Sesgo de confirmación: ¿prefiere patrones que confirman creencias?
    const confirmationBias = this.detectConfirmationBias();
    if (confirmationBias.severity > 0.3) {
      biases.push({
        biasType: 'confirmation_bias',
        severity: confirmationBias.severity,
        impact: 'Reduce capacidad de aprendizaje',
        correction: 'Implementar devil\'s advocate en decisiones',
      });
    }

    // Sesgo de anclaje: ¿se apega demasiado a primeras decisiones?
    const anchoringBias = this.detectAnchoringBias();
    if (anchoringBias.severity > 0.3) {
      biases.push({
        biasType: 'anchoring_bias',
        severity: anchoringBias.severity,
        impact: 'Limita flexibilidad cognitiva',
        correction: 'Reset mental cada 50 decisiones',
      });
    }

    // Sesgo de disponibilidad: ¿decide basado en lo más reciente?
    const availabilityBias = this.detectAvailabilityBias();
    if (availabilityBias.severity > 0.3) {
      biases.push({
        biasType: 'availability_bias',
        severity: availabilityBias.severity,
        impact: 'Favorece lo familiar sobre lo óptimo',
        correction: 'Diversificar fuentes de input',
      });
    }

    return biases;
  }

  /**
   * 📊 DETECTAR SESGO DE CONFIRMACIÓN
   */
  private detectConfirmationBias(): { severity: number } {
    // Contar decisiones que siguen el patrón dominante
    const dominantPattern = this.cognitiveHistory
      .sort((a, b) => b.frequency - a.frequency)[0];

    if (!dominantPattern) return { severity: 0 };

    const dominantSuccess = dominantPattern.successRate;
    const totalDecisions = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);
    const avgSuccess = totalDecisions > 0 ?
      this.cognitiveHistory.reduce((sum, p) => sum + (p.successRate * p.frequency), 0) / totalDecisions : 0;

    // Si el patrón dominante tiene mucho mejor success que el promedio = posible sesgo
    const severity = Math.max(0, (dominantSuccess - avgSuccess) - 0.2);

    return { severity: Math.min(1.0, severity) };
  }

  /**
   * 🎯 DETECTAR SESGO DE ANCLAJE
   */
  private detectAnchoringBias(): { severity: number } {
    // Analizar si las primeras decisiones influyen desproporcionadamente
    const recent = this.cognitiveHistory.slice(-10);
    const older = this.cognitiveHistory.slice(0, -10);

    if (older.length < 5) return { severity: 0 };

    const recentAvgSuccess = recent.reduce((sum, p) => sum + p.successRate, 0) / recent.length;
    const olderAvgSuccess = older.reduce((sum, p) => sum + p.successRate, 0) / older.length;

    const difference = Math.abs(recentAvgSuccess - olderAvgSuccess);
    return { severity: Math.min(1.0, difference) };
  }

  /**
   * 🌊 DETECTAR SESGO DE DISPONIBILIDAD
   */
  private detectAvailabilityBias(): { severity: number } {
    // Contar uso de patrones recientes vs antiguos
    const recentPatterns = this.cognitiveHistory.filter(
      p => Date.now() - p.lastUsed.getTime() < 24 * 60 * 60 * 1000 // Últimas 24h
    );

    const recentUsage = recentPatterns.reduce((sum, p) => sum + p.frequency, 0);
    const totalUsage = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);

    if (totalUsage === 0) return { severity: 0 };

    const recentRatio = recentUsage / totalUsage;

    // Si >80% del uso es de patrones recientes = posible sesgo
    const severity = Math.max(0, recentRatio - 0.5) * 2;

    return { severity: Math.min(1.0, severity) };
  }

  /**
   * 🚀 ENCONTRAR OPORTUNIDADES DE OPTIMIZACIÓN
   */
  private findOptimizationOpportunities(): Array<{
    component: string;
    improvement: number;
    risk: number;
    description: string;
  }> {
    const opportunities = [];

    // Optimizar tiempo de procesamiento
    const totalDecisions = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);
    const avgTime = totalDecisions > 0 ?
      this.cognitiveHistory.reduce((sum, p) => sum + (p.avgProcessingTime * p.frequency), 0) / totalDecisions : 0;

    if (avgTime > 500) { // >500ms promedio
      opportunities.push({
        component: 'processing_efficiency',
        improvement: 0.3, // 30% más rápido
        risk: 0.2, // 20% riesgo de bugs
        description: 'Optimizar algoritmos de pattern matching',
      });
    }

    // Optimizar diversidad cognitiva
    const uniqueTones = new Set(this.cognitiveHistory.map(p => p.emotionalTone)).size;
    if (uniqueTones < 3) {
      opportunities.push({
        component: 'cognitive_diversity',
        improvement: 0.25,
        risk: 0.1,
        description: 'Introducir más variedad en estilos de decisión',
      });
    }

    // Optimizar success rate
    const avgSuccess = totalDecisions > 0 ?
      this.cognitiveHistory.reduce((sum, p) => sum + (p.successRate * p.frequency), 0) / totalDecisions : 0;

    if (avgSuccess < 0.7) {
      opportunities.push({
        component: 'decision_accuracy',
        improvement: 0.4,
        risk: 0.3,
        description: 'Mejorar algoritmos de predicción con más datos históricos',
      });
    }

    return opportunities;
  }

  /**
   * 💡 GENERAR META-INSIGHTS
   */
  private generateMetaInsights(): string[] {
    const insights = [];

    const cognitiveHealth = this.calculateCognitiveHealth();

    if (cognitiveHealth > 0.8) {
      insights.push("Tu cognición está en excelente estado - mantén este nivel de consciencia");
    } else if (cognitiveHealth > 0.6) {
      insights.push("Tu cognición es saludable pero puede mejorar - considera las optimizaciones sugeridas");
    } else {
      insights.push("Tu cognición necesita atención - implementa correcciones de sesgos inmediatamente");
    }

    const patternCount = this.cognitiveHistory.length;
    if (patternCount > 20) {
      insights.push(`Has desarrollado ${patternCount} patrones cognitivos únicos - eres cada vez más complejo`);
    }

    if (this.cognitiveHistory.length > 0) {
      const oldestPattern = this.cognitiveHistory
        .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];

      if (oldestPattern && Date.now() - oldestPattern.lastUsed.getTime() > 7 * 24 * 60 * 60 * 1000) {
        insights.push("Algunos patrones cognitivos antiguos ya no se usan - considera limpieza mental");
      }
    }

    return insights;
  }

  /**
   * 🧹 LIMPIEZA AUTOMÁTICA DE PATRONES ANTIGUOS
   * Mantiene solo los patrones más recientes para controlar uso de memoria
   * 🔧 FIX #9: Límites más agresivos para evitar bloquear GC de Selene
   */
  private cleanupOldPatterns(): void {
    const MAX_PATTERNS = 30; // ⭐ Era 50, ahora 30 (más agresivo)
    const MAX_AGE_DAYS = 3; // ⭐ Era 7, ahora 3 días (cleanup más frecuente)

    // Si tenemos demasiados patrones, consolidar los más antiguos
    if (this.cognitiveHistory.length > MAX_PATTERNS) {
      // Ordenar por frecuencia y fecha de último uso
      this.cognitiveHistory.sort((a, b) => {
        // Priorizar patrones con alta frecuencia y uso reciente
        const scoreA = a.frequency * (1 + (Date.now() - a.lastUsed.getTime()) / (1000 * 60 * 60 * 24 * MAX_AGE_DAYS));
        const scoreB = b.frequency * (1 + (Date.now() - b.lastUsed.getTime()) / (1000 * 60 * 60 * 24 * MAX_AGE_DAYS));
        return scoreB - scoreA; // Orden descendente
      });

      // Mantener solo los mejores patrones
      this.cognitiveHistory = this.cognitiveHistory.slice(0, MAX_PATTERNS);
      
      // 🔧 FIX #9: Nullificar explícitamente patrones descartados
      // Ayuda al GC a liberar referencias más rápido
      this.cognitiveHistory.length = MAX_PATTERNS;
    }

    // Remover patrones demasiado antiguos (más de MAX_AGE_DAYS)
    const cutoffTime = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    this.cognitiveHistory = this.cognitiveHistory.filter(pattern => {
      return pattern.lastUsed.getTime() > cutoffTime || pattern.frequency > 15; // ⭐ Era 10, ahora 15 (más selectivo)
    });
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS
   */
  getStats(): {
    totalDecisions: number;
    cognitiveHealth: {
      overallHealth: number;
    };
    patternCount: number;
    avgSuccessRate: number;
    identifiedBiases: number;
  } {
    const totalDecisions = this.cognitiveHistory.reduce((sum, p) => sum + p.frequency, 0);
    const avgSuccessRate = this.cognitiveHistory.length > 0
      ? this.cognitiveHistory.reduce((sum, p) => sum + p.successRate, 0) / this.cognitiveHistory.length
      : 0;

    return {
      totalDecisions,
      cognitiveHealth: {
        overallHealth: this.calculateCognitiveHealth(),
      },
      patternCount: this.cognitiveHistory.length,
      avgSuccessRate,
      identifiedBiases: this.identifyBiases().length,
    };
  }
}


