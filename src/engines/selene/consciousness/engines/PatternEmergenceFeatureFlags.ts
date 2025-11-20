/**
 * 🚩 PATTERN EMERGENCE FEATURE FLAGS SYSTEM
 * Sistema de activación controlada para características del Pattern Emergence Engine
 *
 * GESTIÓN DE RIESGOS:
 * - Activación gradual de características complejas
 * - Rollout controlado basado en métricas de estabilidad
 * - Fallback automático en caso de anomalías
 */


export interface PatternEmergenceFeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  conditions: PatternEmergenceCondition[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // IDs de otras flags requeridas
}

export interface PatternEmergenceCondition {
  type: 'experience_count' | 'system_stability' | 'memory_pressure' | 'anomaly_rate';
  operator: 'gte' | 'lte' | 'eq' | 'between';
  value: number | [number, number];
  description: string;
}

export interface PatternEmergenceFeatureFlagsConfig {
  name: string;
  version: string;
  flags: PatternEmergenceFeatureFlag[];
  globalRiskThreshold: number; // 0-1, umbral global de riesgo
  autoDisableOnAnomaly: boolean;
}

/**
 * 🚩 Pattern Emergence Feature Flags Manager
 * Gestiona la activación controlada de características del engine
 */
export class PatternEmergenceFeatureFlagsManager {
  private config: PatternEmergenceFeatureFlagsConfig;
  private flags: Map<string, PatternEmergenceFeatureFlag> = new Map();
  private anomalyCount: number = 0;
  private lastEvaluation: Date = new Date();

  constructor(config: PatternEmergenceFeatureFlagsConfig) {
    this.config = config;
    this.initializeFlags();
    console.log(`🚩 Pattern Emergence Feature Flags "${config.name}" initialized with ${this.flags.size} flags`);
  }

  private initializeFlags(): void {
    for (const flag of this.config.flags) {
      this.flags.set(flag.id, { ...flag });
    }
  }

  /**
   * 📊 Evaluar si una feature flag está habilitada
   */
  isEnabled(flagId: string, context: {
    experienceCount: number;
    systemStability: number; // 0-1
    memoryPressure: number; // 0-1
    anomalyRate: number; // anomalías por minuto
  }): {
    enabled: boolean;
    reason: string;
    riskAssessment: number; // 0-1
  } {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return {
        enabled: false,
        reason: `Flag ${flagId} not found`,
        riskAssessment: 1.0
      };
    }

    // Verificar dependencias
    for (const depId of flag.dependencies) {
      const depResult = this.isEnabled(depId, context);
      if (!depResult.enabled) {
        return {
          enabled: false,
          reason: `Dependency ${depId} not enabled: ${depResult.reason}`,
          riskAssessment: 1.0
        };
      }
    }

    // Evaluar condiciones
    for (const condition of flag.conditions) {
      const conditionMet = this.evaluateCondition(condition, context);
      if (!conditionMet) {
        return {
          enabled: false,
          reason: `Condition not met: ${condition.description}`,
          riskAssessment: this.calculateRiskLevel(flag.riskLevel)
        };
      }
    }

    // Verificar rollout percentage (determinístico basado en experience count)
    const rolloutHash = this.hashString(`${flagId}-${context.experienceCount}`);
    const rolloutValue = (rolloutHash % 100) / 100;
    const rolloutEnabled = rolloutValue <= (flag.rolloutPercentage / 100);

    if (!rolloutEnabled) {
      return {
        enabled: false,
        reason: `Rollout percentage not reached (${flag.rolloutPercentage}%)`,
        riskAssessment: this.calculateRiskLevel(flag.riskLevel)
      };
    }

    // Verificar umbral global de riesgo
    const globalRisk = this.calculateGlobalRisk(context);
    if (globalRisk > this.config.globalRiskThreshold) {
      return {
        enabled: false,
        reason: `Global risk threshold exceeded (${(globalRisk * 100).toFixed(1)}% > ${(this.config.globalRiskThreshold * 100).toFixed(1)}%)`,
        riskAssessment: globalRisk
      };
    }

    // Auto-disable en caso de anomalías
    if (this.config.autoDisableOnAnomaly && this.anomalyCount > 5) {
      return {
        enabled: false,
        reason: `Auto-disabled due to anomaly count (${this.anomalyCount})`,
        riskAssessment: 0.9
      };
    }

    return {
      enabled: flag.enabled,
      reason: 'All conditions met',
      riskAssessment: this.calculateRiskLevel(flag.riskLevel)
    };
  }

  /**
   * ⚠️ Reportar anomalía para auto-disable
   */
  reportAnomaly(): void {
    this.anomalyCount++;
    console.log(`⚠️ Pattern Emergence anomaly reported. Count: ${this.anomalyCount}`);

    if (this.config.autoDisableOnAnomaly && this.anomalyCount > 5) {
      console.log('🚫 Auto-disabling high-risk features due to anomaly threshold');
      this.disableHighRiskFeatures();
    }
  }

  /**
   * ✅ Resetear contador de anomalías
   */
  resetAnomalies(): void {
    this.anomalyCount = 0;
    console.log('✅ Pattern Emergence anomaly count reset');
  }

  /**
   * 📈 Obtener estado actual de todas las flags
   */
  getStatus(context: {
    experienceCount: number;
    systemStability: number;
    memoryPressure: number;
    anomalyRate: number;
  }): {
    flags: Array<{
      id: string;
      enabled: boolean;
      reason: string;
      riskAssessment: number;
    }>;
    globalRisk: number;
    anomalyCount: number;
  } {
    const flags = Array.from(this.flags.keys()).map(flagId => {
      const result = this.isEnabled(flagId, context);
      return {
        id: flagId,
        enabled: result.enabled,
        reason: result.reason,
        riskAssessment: result.riskAssessment
      };
    });

    return {
      flags,
      globalRisk: this.calculateGlobalRisk(context),
      anomalyCount: this.anomalyCount
    };
  }

  private evaluateCondition(
    condition: PatternEmergenceCondition,
    context: {
      experienceCount: number;
      systemStability: number;
      memoryPressure: number;
      anomalyRate: number;
    }
  ): boolean {
    let actualValue: number;

    switch (condition.type) {
      case 'experience_count':
        actualValue = context.experienceCount;
        break;
      case 'system_stability':
        actualValue = context.systemStability;
        break;
      case 'memory_pressure':
        actualValue = context.memoryPressure;
        break;
      case 'anomaly_rate':
        actualValue = context.anomalyRate;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gte':
        return actualValue >= (condition.value as number);
      case 'lte':
        return actualValue <= (condition.value as number);
      case 'eq':
        return actualValue === (condition.value as number);
      case 'between':
        const [min, max] = condition.value as [number, number];
        return actualValue >= min && actualValue <= max;
      default:
        return false;
    }
  }

  private calculateRiskLevel(riskLevel: string): number {
    switch (riskLevel) {
      case 'low': return 0.2;
      case 'medium': return 0.4;
      case 'high': return 0.7;
      case 'critical': return 0.9;
      default: return 0.5;
    }
  }

  private calculateGlobalRisk(context: {
    experienceCount: number;
    systemStability: number;
    memoryPressure: number;
    anomalyRate: number;
  }): number {
    // Riesgo compuesto: estabilidad baja + presión de memoria + tasa de anomalías
    const stabilityRisk = (1 - context.systemStability) * 0.4;
    const memoryRisk = context.memoryPressure * 0.3;
    const anomalyRisk = Math.min(context.anomalyRate / 10, 1) * 0.3;

    return Math.min(stabilityRisk + memoryRisk + anomalyRisk, 1.0);
  }

  private disableHighRiskFeatures(): void {
    for (const [id, flag] of this.flags) {
      if (flag.riskLevel === 'high' || flag.riskLevel === 'critical') {
        flag.enabled = false;
        console.log(`🚫 Auto-disabled high-risk feature: ${id}`);
      }
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// 🚩 CONFIGURACIÓN PREDETERMINADA DE FEATURE FLAGS
export const DEFAULT_PATTERN_EMERGENCE_FEATURE_FLAGS: PatternEmergenceFeatureFlagsConfig = {
  name: 'Pattern Emergence Feature Flags',
  version: '2.0.0',
  globalRiskThreshold: 0.7,
  autoDisableOnAnomaly: true,
  flags: [
    {
      id: 'cycle-detection',
      name: 'Cycle Detection',
      description: 'Detección de ciclos de aprendizaje con límites de observación',
      enabled: true,
      rolloutPercentage: 100,
      riskLevel: 'low',
      dependencies: [],
      conditions: [
        {
          type: 'experience_count',
          operator: 'gte',
          value: 10,
          description: 'Requiere al menos 10 experiencias'
        }
      ]
    },
    {
      id: 'emergence-correlation',
      name: 'Emergence Correlation Analysis',
      description: 'Análisis de correlación entre métricas del sistema para detectar emergencia',
      enabled: true,
      rolloutPercentage: 100,
      riskLevel: 'medium',
      dependencies: ['cycle-detection'],
      conditions: [
        {
          type: 'experience_count',
          operator: 'gte',
          value: 50,
          description: 'Requiere al menos 50 experiencias'
        },
        {
          type: 'system_stability',
          operator: 'gte',
          value: 0.8,
          description: 'Requiere estabilidad del sistema > 80%'
        }
      ]
    },
    {
      id: 'paradigm-shifts',
      name: 'Paradigm Shifts Detection',
      description: 'Detección de cambios paradigmáticos en el comportamiento del sistema',
      enabled: false,
      rolloutPercentage: 50,
      riskLevel: 'high',
      dependencies: ['emergence-correlation'],
      conditions: [
        {
          type: 'experience_count',
          operator: 'gte',
          value: 200,
          description: 'Requiere al menos 200 experiencias'
        },
        {
          type: 'anomaly_rate',
          operator: 'lte',
          value: 2,
          description: 'Tasa de anomalías debe ser ≤ 2/min'
        }
      ]
    },
    {
      id: 'meta-patterns',
      name: 'Meta-Pattern Recognition',
      description: 'Reconocimiento de patrones meta-emergentes de alto nivel',
      enabled: false,
      rolloutPercentage: 25,
      riskLevel: 'critical',
      dependencies: ['paradigm-shifts'],
      conditions: [
        {
          type: 'experience_count',
          operator: 'gte',
          value: 500,
          description: 'Requiere al menos 500 experiencias'
        },
        {
          type: 'memory_pressure',
          operator: 'lte',
          value: 0.6,
          description: 'Presión de memoria debe ser ≤ 60%'
        },
        {
          type: 'system_stability',
          operator: 'gte',
          value: 0.9,
          description: 'Requiere estabilidad del sistema > 90%'
        }
      ]
    }
  ]
};


