/**
 * 🎭 META ORCHESTRATOR - COORDINADOR DE META-CONSCIENCIA
 * Fase 0: Esqueleto base para orquestación de engines
 *
 * Coordina: SelfAnalysis, PatternEmergence, DreamForge, EthicalCore, AutoOptimization
 * Forged by PunkClaude + Claude 4.5
 */
import { MetaOrchestrator, MetaOrchestratorConfig, OrchestrationContext, OrchestrationResult, EngineHealthSummary } from './MetaEngineInterfaces.js';
import { BaseMetaEngineImpl } from './BaseMetaEngine.js';
export declare abstract class MetaOrchestratorImpl implements MetaOrchestrator {
    private readonly config;
    private readonly engineRegistry;
    private readonly safetyOrchestration;
    private engines;
    private isInitialized;
    constructor(config: MetaOrchestratorConfig);
    /**
     * 🚀 Initialize the orchestrator and all engines
     */
    initialize(): Promise<void>;
    /**
     * 🎯 Execute meta-consciousness orchestration
     */
    orchestrate(context: OrchestrationContext): Promise<OrchestrationResult>;
    /**
     * 📊 Get orchestrator health summary
     */
    getHealthSummary(): Promise<EngineHealthSummary>;
    /**
     * 🧹 Cleanup all engines and orchestrator
     */
    cleanup(): Promise<void>;
    private validateConfig;
    private initializeSafetyOrchestration;
    private initializeEngines;
    private checkGlobalSafety;
    private executeOrchestrationPhases;
    private executeEnginePhase;
    private updateGlobalHealth;
    private countCriticalFailures;
    private isOnlyQuotaFailure;
    private recordGlobalFailure;
    private emergencyShutdown;
    /**
     * 🔧 Create engine instance (to be implemented by subclasses)
     */
    protected abstract createEngine(config: any): Promise<BaseMetaEngineImpl>;
}
//# sourceMappingURL=MetaOrchestrator.d.ts.map