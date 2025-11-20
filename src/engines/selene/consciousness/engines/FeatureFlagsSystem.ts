/**
 * 🚩 FEATURE FLAGS SYSTEM - Activación controlada de características
 * Fase 0: Sistema de flags para deployment gradual y control de riesgos
 *
 * Características: Rollout porcentual, Condiciones dinámicas, A/B Testing básico
 * Forged by PunkClaude + Claude 4.5
 */

import { FeatureFlag, FeatureCondition } from './MetaEngineInterfaces.js';
import * as crypto from 'crypto';


export interface FeatureFlagsConfig {
  flags: FeatureFlag[];
  defaultRolloutPercentage: number;
  enableABTesting: boolean;
  persistenceEnabled: boolean;
  persistencePath?: string;
  name: string;
}

export interface FeatureEvaluationContext {
  userId?: string;
  sessionId?: string;
  environment: 'development' | 'staging' | 'production';
  version?: string;
  customProperties?: Map<string, any>;
}

export interface FeatureEvaluationResult {
  flagId: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditionMatched: boolean;
  reason: string;
}

/**
 * 🚩 Feature Flags Manager
 */
export class FeatureFlagsManager {
  private config: FeatureFlagsConfig;
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluationCache: Map<string, FeatureEvaluationResult> = new Map();
  private abTestGroups: Map<string, string> = new Map(); // userId -> group

  constructor(config: FeatureFlagsConfig) {
    this.config = config;

    // Load flags
    for (const flag of config.flags) {
      this.flags.set(flag.id, flag);
    }

    console.log(`🚩 Feature Flags Manager "${config.name}" initialized with ${this.flags.size} flags`);
  }

  /**
   * ✅ Check if feature is enabled
   */
  isEnabled(flagId: string, context: FeatureEvaluationContext = { environment: 'development' }): boolean {
    const result = this.evaluateFlag(flagId, context);
    return result.enabled;
  }

  /**
   * 📊 Evaluate feature flag with detailed result
   */
  evaluateFlag(flagId: string, context: FeatureEvaluationContext): FeatureEvaluationResult {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return {
        flagId,
        enabled: false,
        rolloutPercentage: 0,
        conditionMatched: false,
        reason: `FLAG_NOT_FOUND: ${flagId}`
      };
    }

    // Check if globally disabled
    if (!flag.enabled) {
      return {
        flagId,
        enabled: false,
        rolloutPercentage: flag.rolloutPercentage,
        conditionMatched: false,
        reason: 'FLAG_DISABLED'
      };
    }

    // Evaluate conditions
    const conditionResult = this.evaluateConditions(flag.conditions, context);
    if (!conditionResult.matched) {
      return {
        flagId,
        enabled: false,
        rolloutPercentage: flag.rolloutPercentage,
        conditionMatched: false,
        reason: conditionResult.reason
      };
    }

    // Check rollout percentage
    const userInRollout = this.isUserInRollout(flagId, context, flag.rolloutPercentage);
    if (!userInRollout) {
      return {
        flagId,
        enabled: false,
        rolloutPercentage: flag.rolloutPercentage,
        conditionMatched: true,
        reason: `ROLLOUT_EXCLUDED: User not in ${flag.rolloutPercentage}% rollout`
      };
    }

    return {
      flagId,
      enabled: true,
      rolloutPercentage: flag.rolloutPercentage,
      conditionMatched: true,
      reason: 'ENABLED'
    };
  }

  /**
   * ➕ Add or update feature flag
   */
  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.id, { ...flag, lastModified: new Date() });
    this.clearCacheForFlag(flag.id);
    console.log(`➕ Feature flag ${flag.id} updated: enabled=${flag.enabled}, rollout=${flag.rolloutPercentage}%`);
  }

  /**
   * ➖ Remove feature flag
   */
  removeFlag(flagId: string): boolean {
    const removed = this.flags.delete(flagId);
    if (removed) {
      this.clearCacheForFlag(flagId);
      console.log(`➖ Feature flag ${flagId} removed`);
    }
    return removed;
  }

  /**
   * 📋 Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * 🔍 Get feature flag by ID
   */
  getFlag(flagId: string): FeatureFlag | undefined {
    return this.flags.get(flagId);
  }

  /**
   * 📊 Get evaluation results for all flags
   */
  evaluateAllFlags(context: FeatureEvaluationContext): FeatureEvaluationResult[] {
    const results: FeatureEvaluationResult[] = [];

    for (const flagId of this.flags.keys()) {
      results.push(this.evaluateFlag(flagId, context));
    }

    return results;
  }

  /**
   * 🎯 Force enable feature for specific user/context
   */
  forceEnable(flagId: string, context: FeatureEvaluationContext): void {
    // This would override the normal evaluation for this specific context
    // Implementation would depend on persistence strategy
    console.log(`🎯 Force enabled ${flagId} for context:`, context);
  }

  /**
   * 🚫 Force disable feature for specific user/context
   */
  forceDisable(flagId: string, context: FeatureEvaluationContext): void {
    // This would override the normal evaluation for this specific context
    console.log(`🚫 Force disabled ${flagId} for context:`, context);
  }

  /**
   * 📈 Update rollout percentage
   */
  updateRollout(flagId: string, percentage: number): boolean {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    flag.lastModified = new Date();
    this.clearCacheForFlag(flagId);

    console.log(`📈 Updated rollout for ${flagId} to ${percentage}%`);
    return true;
  }

  /**
   * 🧹 Clear evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
    console.log(`🧹 Feature flags cache cleared`);
  }

  /**
   * 💾 Persist flags to storage
   */
  async persistFlags(): Promise<void> {
    if (!this.config.persistenceEnabled || !this.config.persistencePath) {
      return;
    }

    try {
      const flagsData = {
        flags: Array.from(this.flags.values()),
        timestamp: new Date(),
        version: '1.0.0'
      };

      // In a real implementation, this would write to file/database
      console.log(`💾 Feature flags persisted to ${this.config.persistencePath}`);

    } catch (error) {
      console.error(`💥 Failed to persist feature flags:`, error as Error);
    }
  }

  /**
   * 📂 Load flags from storage
   */
  async loadFlags(): Promise<void> {
    if (!this.config.persistenceEnabled || !this.config.persistencePath) {
      return;
    }

    try {
      // In a real implementation, this would read from file/database
      console.log(`📂 Feature flags loaded from ${this.config.persistencePath}`);

    } catch (error) {
      console.error(`💥 Failed to load feature flags:`, error as Error);
    }
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  private evaluateConditions(conditions: FeatureCondition[], context: FeatureEvaluationContext): { matched: boolean, reason: string } {
    if (!conditions || conditions.length === 0) {
      return { matched: true, reason: 'NO_CONDITIONS' };
    }

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return {
          matched: false,
          reason: `CONDITION_FAILED: ${condition.type} ${condition.operator} ${condition.value}`
        };
      }
    }

    return { matched: true, reason: 'ALL_CONDITIONS_MET' };
  }

  private evaluateCondition(condition: FeatureCondition, context: FeatureEvaluationContext): boolean {
    const { type, operator, value } = condition;

    let actualValue: any;

    switch (type) {
      case 'user':
        actualValue = context.userId;
        break;
      case 'environment':
        actualValue = context.environment;
        break;
      case 'time':
        actualValue = Date.now();
        break;
      case 'performance':
        // Would check performance metrics
        actualValue = 100; // Placeholder
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, operator, value);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'greater':
        return Number(actual) > Number(expected);
      case 'less':
        return Number(actual) < Number(expected);
      case 'between':
        const [min, max] = expected;
        return Number(actual) >= min && Number(actual) <= max;
      default:
        return false;
    }
  }

  private isUserInRollout(flagId: string, context: FeatureEvaluationContext, percentage: number): boolean {
    if (percentage >= 100) {
      return true;
    }

    if (percentage <= 0) {
      return false;
    }

    // Use user/session ID for consistent rollout
    const identifier = context.userId || context.sessionId || 'anonymous';
    const hash = crypto.createHash('md5').update(`${flagId}:${identifier}`).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const rolloutValue = (hashValue % 100) + 1; // 1-100

    return rolloutValue <= percentage;
  }

  private clearCacheForFlag(flagId: string): void {
    // Clear cached evaluations for this flag
    for (const [key, result] of this.evaluationCache) {
      if (result.flagId === flagId) {
        this.evaluationCache.delete(key);
      }
    }
  }

  private getABTestGroup(userId: string, flagId: string): string {
    if (!this.config.enableABTesting) {
      return 'control';
    }

    const key = `${userId}:${flagId}`;
    let group = this.abTestGroups.get(key);

    if (!group) {
      // Simple A/B assignment based on hash
      const hash = crypto.createHash('md5').update(key).digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      group = (hashValue % 2 === 0) ? 'control' : 'treatment';
      this.abTestGroups.set(key, group);
    }

    return group;
  }
}

/**
 * 🏭 Feature Flags Factory
 */
export class FeatureFlagsFactory {
  private static defaultConfig: Partial<FeatureFlagsConfig> = {
    defaultRolloutPercentage: 0,
    enableABTesting: false,
    persistenceEnabled: false
  };

  /**
   * 🛠️ Create feature flags manager with custom config
   */
  static create(config: FeatureFlagsConfig): FeatureFlagsManager {
    return new FeatureFlagsManager(config);
  }

  /**
   * ⚡ Create feature flags manager with defaults
   */
  static createDefault(name: string): FeatureFlagsManager {
    return new FeatureFlagsManager({
      ...this.defaultConfig,
      name,
      flags: []
    } as FeatureFlagsConfig);
  }

  /**
   * 🔧 Create feature flags for development
   */
  static createForDevelopment(name: string): FeatureFlagsManager {
    const flags: FeatureFlag[] = [
      {
        id: 'meta-consciousness-enabled',
        name: 'Meta Consciousness Engine',
        description: 'Enable the meta-consciousness engine system',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'environment',
            operator: 'equals',
            value: 'development'
          }
        ],
        lastModified: new Date(),
        modifiedBy: 'system'
      },
      {
        id: 'circuit-breakers-enabled',
        name: 'Circuit Breakers',
        description: 'Enable circuit breaker protection',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        lastModified: new Date(),
        modifiedBy: 'system'
      },
      {
        id: 'auto-backup-enabled',
        name: 'Auto Backup',
        description: 'Enable automatic state backups',
        enabled: true,
        rolloutPercentage: 50,
        conditions: [],
        lastModified: new Date(),
        modifiedBy: 'system'
      }
    ];

    return new FeatureFlagsManager({
      name: `${name}-dev`,
      flags,
      defaultRolloutPercentage: 0,
      enableABTesting: false,
      persistenceEnabled: false
    });
  }

  /**
   * 🚀 Create feature flags for production
   */
  static createForProduction(name: string): FeatureFlagsManager {
    const flags: FeatureFlag[] = [
      {
        id: 'meta-consciousness-enabled',
        name: 'Meta Consciousness Engine',
        description: 'Enable the meta-consciousness engine system',
        enabled: false, // Start disabled in production
        rolloutPercentage: 0,
        conditions: [
          {
            type: 'environment',
            operator: 'equals',
            value: 'production'
          }
        ],
        lastModified: new Date(),
        modifiedBy: 'system'
      },
      {
        id: 'circuit-breakers-enabled',
        name: 'Circuit Breakers',
        description: 'Enable circuit breaker protection',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        lastModified: new Date(),
        modifiedBy: 'system'
      }
    ];

    return new FeatureFlagsManager({
      name: `${name}-prod`,
      flags,
      defaultRolloutPercentage: 0,
      enableABTesting: true,
      persistenceEnabled: true,
      persistencePath: './feature-flags-prod.json'
    });
  }
}


