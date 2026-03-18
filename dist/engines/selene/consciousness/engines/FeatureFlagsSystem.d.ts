/**
 * 🚩 FEATURE FLAGS SYSTEM - Activación controlada de características
 * Fase 0: Sistema de flags para deployment gradual y control de riesgos
 *
 * Características: Rollout porcentual, Condiciones dinámicas, A/B Testing básico
 * Forged by PunkClaude + Claude 4.5
 */
import { FeatureFlag } from './MetaEngineInterfaces.js';
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
export declare class FeatureFlagsManager {
    private config;
    private flags;
    private evaluationCache;
    private abTestGroups;
    constructor(config: FeatureFlagsConfig);
    /**
     * ✅ Check if feature is enabled
     */
    isEnabled(flagId: string, context?: FeatureEvaluationContext): boolean;
    /**
     * 📊 Evaluate feature flag with detailed result
     */
    evaluateFlag(flagId: string, context: FeatureEvaluationContext): FeatureEvaluationResult;
    /**
     * ➕ Add or update feature flag
     */
    setFlag(flag: FeatureFlag): void;
    /**
     * ➖ Remove feature flag
     */
    removeFlag(flagId: string): boolean;
    /**
     * 📋 Get all feature flags
     */
    getAllFlags(): FeatureFlag[];
    /**
     * 🔍 Get feature flag by ID
     */
    getFlag(flagId: string): FeatureFlag | undefined;
    /**
     * 📊 Get evaluation results for all flags
     */
    evaluateAllFlags(context: FeatureEvaluationContext): FeatureEvaluationResult[];
    /**
     * 🎯 Force enable feature for specific user/context
     */
    forceEnable(flagId: string, context: FeatureEvaluationContext): void;
    /**
     * 🚫 Force disable feature for specific user/context
     */
    forceDisable(flagId: string, context: FeatureEvaluationContext): void;
    /**
     * 📈 Update rollout percentage
     */
    updateRollout(flagId: string, percentage: number): boolean;
    /**
     * 🧹 Clear evaluation cache
     */
    clearCache(): void;
    /**
     * 💾 Persist flags to storage
     */
    persistFlags(): Promise<void>;
    /**
     * 📂 Load flags from storage
     */
    loadFlags(): Promise<void>;
    private evaluateConditions;
    private evaluateCondition;
    private compareValues;
    private isUserInRollout;
    private clearCacheForFlag;
    private getABTestGroup;
}
/**
 * 🏭 Feature Flags Factory
 */
export declare class FeatureFlagsFactory {
    private static defaultConfig;
    /**
     * 🛠️ Create feature flags manager with custom config
     */
    static create(config: FeatureFlagsConfig): FeatureFlagsManager;
    /**
     * ⚡ Create feature flags manager with defaults
     */
    static createDefault(name: string): FeatureFlagsManager;
    /**
     * 🔧 Create feature flags for development
     */
    static createForDevelopment(name: string): FeatureFlagsManager;
    /**
     * 🚀 Create feature flags for production
     */
    static createForProduction(name: string): FeatureFlagsManager;
}
//# sourceMappingURL=FeatureFlagsSystem.d.ts.map