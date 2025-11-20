/**
 * 🎭 META ORCHESTRATOR - COORDINADOR DE META-CONSCIENCIA
 * Fase 0: Esqueleto base para orquestación de engines
 *
 * Coordina: SelfAnalysis, PatternEmergence, DreamForge, EthicalCore, AutoOptimization
 * Forged by PunkClaude + Claude 4.5
 */

import {
  MetaOrchestrator,
  MetaOrchestratorConfig,
  EngineRegistry,
  OrchestrationContext,
  OrchestrationResult,
  EnginePriority,
  EngineHealthSummary,
  SafetyOrchestration,
  EngineHealth,
  HealthIssue
} from './MetaEngineInterfaces.js';
import { BaseMetaEngineImpl } from './BaseMetaEngine.js';
import * as crypto from 'crypto';

export abstract class MetaOrchestratorImpl implements MetaOrchestrator {
  private readonly config: MetaOrchestratorConfig;
  private readonly engineRegistry: EngineRegistry;
  private readonly safetyOrchestration: SafetyOrchestration;

  // Engine instances
  private engines: Map<string, BaseMetaEngineImpl> = new Map();
  private isInitialized: boolean = false;

  constructor(config: MetaOrchestratorConfig) {
    this.config = config;
    

    this.engineRegistry = {
      engines: new Map(),
      priorities: new Map(),
      dependencies: new Map(),
      healthStatus: new Map()
    };

    this.safetyOrchestration = {
      globalCircuitBreaker: {
        failures: 0,
        state: 'closed'
      },
      emergencyShutdown: false,
      lastGlobalHealthCheck: new Date(),
      activeOperations: new Set()
    };

    console.log(`🎭 MetaOrchestrator initialized: ${config.name} v${config.version}`);
  }

  /**
   * 🚀 Initialize the orchestrator and all engines
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing MetaOrchestrator...');

      // Validate configuration
      this.validateConfig();

      // Initialize safety orchestration
      await this.initializeSafetyOrchestration();

      // Register and initialize engines
      await this.initializeEngines();

      this.isInitialized = true;
      console.log('✅ MetaOrchestrator initialized successfully');

    } catch (error) {
      console.error('💥 Failed to initialize MetaOrchestrator:', error);
      await this.emergencyShutdown();
      throw error;
    }
  }

  /**
   * 🎯 Execute meta-consciousness orchestration
   */
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationResult> {
    if (!this.isInitialized) {
      throw new Error('ORCHESTRATOR_NOT_INITIALIZED: MetaOrchestrator must be initialized before orchestration');
    }

    const correlationId = context.correlationId || crypto.randomUUID();
    const startTime = Date.now();

    try {
      console.log(`🎯 Starting orchestration [${correlationId}]`);

      // Check global safety
      if (!this.checkGlobalSafety()) {
        throw new Error('GLOBAL_SAFETY_VIOLATION: Orchestration blocked by safety systems');
      }

      // Track active operation
      this.safetyOrchestration.activeOperations.add(correlationId);

      // Execute orchestration phases
      const result = await this.executeOrchestrationPhases(context, correlationId);

      // Update global health
      await this.updateGlobalHealth();

      console.log(`✅ Orchestration completed successfully [${correlationId}] in ${Date.now() - startTime}ms`);

      return result;

    } catch (error) {
      console.error(`💥 Orchestration failed [${correlationId}]:`, error);

      // Record global failure
      this.recordGlobalFailure();

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error) || 'Unknown orchestration error'),
        executionTime: Date.now() - startTime,
        correlationId,
        engineResults: [],
        orchestrationMetrics: {
          totalEngines: this.engines.size,
          executedEngines: 0,
          failedEngines: 0,
          averageExecutionTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };

    } finally {
      // Clean up active operation
      this.safetyOrchestration.activeOperations.delete(correlationId);
    }
  }

  /**
   * 📊 Get orchestrator health summary
   */
  async getHealthSummary(): Promise<EngineHealthSummary> {
    const engineHealths: EngineHealthSummary['engineHealths'] = {};

    for (const [engineId, engine] of this.engines) {
      try {
        engineHealths[engineId] = await engine.getHealth();
      } catch (error) {
        console.error(`Failed to get health for engine ${engineId}:`, error);
        engineHealths[engineId] = {
          status: 'unknown',
          score: 0,
          issues: [{
            type: 'health_check',
            severity: 'critical',
            description: 'Unable to retrieve health status',
            recommendation: 'Check engine implementation and logs'
          }],
          lastCheck: new Date()
        };
      }
    }

    // Calculate overall health
    const scores = Object.values(engineHealths).map((h: EngineHealth) => h.score);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;

    const criticalCount = Object.values(engineHealths).filter((h: EngineHealth) =>
      h.issues.some((i: HealthIssue) => i.severity === 'critical')
    ).length;

    const overallStatus = criticalCount > 0 ? 'critical' :
                         averageScore < 60 ? 'unhealthy' :
                         averageScore < 80 ? 'degraded' : 'healthy';

    return {
      overallStatus,
      averageHealthScore: averageScore,
      engineHealths,
      globalSafetyStatus: this.safetyOrchestration.globalCircuitBreaker.state,
      activeOperations: this.safetyOrchestration.activeOperations.size,
      lastGlobalHealthCheck: this.safetyOrchestration.lastGlobalHealthCheck
    };
  }

  /**
   * 🧹 Cleanup all engines and orchestrator
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up MetaOrchestrator...');

      // Cleanup all engines
      for (const [engineId, engine] of this.engines) {
        try {
          await engine.cleanup();
          console.log(`✅ Engine ${engineId} cleaned up`);
        } catch (error) {
          console.error(`💥 Failed to cleanup engine ${engineId}:`, error);
        }
      }

      // Clear registry
      this.engines.clear();
      this.engineRegistry.engines.clear();
      this.engineRegistry.priorities.clear();
      this.engineRegistry.dependencies.clear();
      this.engineRegistry.healthStatus.clear();

      this.isInitialized = false;
      console.log('✅ MetaOrchestrator cleanup completed');

    } catch (error) {
      console.error('💥 MetaOrchestrator cleanup failed:', error);
    }
  }

  // ===========================================
  // PRIVATE METHODS - ORCHESTRATION LOGIC
  // ===========================================

  private validateConfig(): void {
    if (!this.config.name || !this.config.version) {
      throw new Error('INVALID_CONFIG: Orchestrator name and version are required');
    }

    if (!this.config.engineConfigs || this.config.engineConfigs.length === 0) {
      throw new Error('INVALID_CONFIG: At least one engine configuration is required');
    }

    // Validate engine configurations
    for (const engineConfig of this.config.engineConfigs) {
      if (!engineConfig.id || !engineConfig.name) {
        throw new Error(`INVALID_ENGINE_CONFIG: Engine ${engineConfig.id} missing required fields`);
      }
    }
  }

  private async initializeSafetyOrchestration(): Promise<void> {
    // Initialize global health monitoring
    this.safetyOrchestration.lastGlobalHealthCheck = new Date();

    console.log('🛡️ Safety orchestration initialized');
  }

  private async initializeEngines(): Promise<void> {
    console.log('🔧 Initializing engines...');

    for (const engineConfig of this.config.engineConfigs) {
      try {
        // Create engine instance (this will be implemented by subclasses)
        const engine = await this.createEngine(engineConfig);

        // Register engine
        this.engines.set(engineConfig.id, engine);
        this.engineRegistry.engines.set(engineConfig.id, engineConfig);
        this.engineRegistry.priorities.set(engineConfig.id, engineConfig.priority || 'medium');
        this.engineRegistry.dependencies.set(engineConfig.id, engineConfig.dependencies || []);
        this.engineRegistry.healthStatus.set(engineConfig.id, 'healthy');

        console.log(`✅ Engine ${engineConfig.id} initialized`);

      } catch (error) {
        console.error(`💥 Failed to initialize engine ${engineConfig.id}:`, error);
        throw error;
      }
    }

    console.log(`✅ All ${this.engines.size} engines initialized`);
  }

  private checkGlobalSafety(): boolean {
    // Check emergency shutdown
    if (this.safetyOrchestration.emergencyShutdown) {
      console.error('🚨 EMERGENCY SHUTDOWN ACTIVE: Orchestration blocked');
      return false;
    }

    // Check global circuit breaker
    if (this.safetyOrchestration.globalCircuitBreaker.state === 'open') {
      if (this.safetyOrchestration.globalCircuitBreaker.nextAttemptTime &&
          Date.now() < this.safetyOrchestration.globalCircuitBreaker.nextAttemptTime.getTime()) {
        console.warn('🚨 Global circuit breaker open: Orchestration blocked');
        return false;
      }

      // Try half-open state
      this.safetyOrchestration.globalCircuitBreaker.state = 'half-open';
      console.warn('🔄 Global circuit breaker half-open');
    }

    // Check active operations limit
    if (this.safetyOrchestration.activeOperations.size >= this.config.maxConcurrentOperations) {
      console.warn(`🚨 Too many active operations (${this.safetyOrchestration.activeOperations.size}): Orchestration blocked`);
      return false;
    }

    return true;
  }

  private async executeOrchestrationPhases(
    context: OrchestrationContext,
    correlationId: string
  ): Promise<OrchestrationResult> {

    const engineResults: any[] = [];
    let executedEngines = 0;
    let failedEngines = 0;
    let totalExecutionTime = 0;

    try {
      console.log(`🎯 Starting orchestration phases [${correlationId}]`);

      // Phase 1: Self-Analysis (always first)
      console.log(`🎯 Phase 1: Executing self-analysis [${correlationId}]`);
      const selfAnalysisResult = await this.executeEnginePhase('self-analysis', context, correlationId);
      console.log(`🎯 Phase 1 completed: ${selfAnalysisResult.success ? 'SUCCESS' : 'FAILED'} [${correlationId}]`);
      engineResults.push(selfAnalysisResult);
      if (selfAnalysisResult.success) executedEngines++; else failedEngines++;
      totalExecutionTime += selfAnalysisResult.executionTime;

      // Phase 2: Pattern Emergence (parallel with safety checks)
      console.log(`🎯 Phase 2: Executing pattern-emergence [${correlationId}]`);
      const patternResult = await this.executeEnginePhase('pattern-emergence', context, correlationId);
      console.log(`🎯 Phase 2 completed: ${patternResult.success ? 'SUCCESS' : 'FAILED'} [${correlationId}]`);
      engineResults.push(patternResult);
      if (patternResult.success) executedEngines++; else failedEngines++;
      totalExecutionTime += patternResult.executionTime;

      // Phase 3: Dream Forge (creative phase)
      console.log(`🎯 Phase 3: Executing dream-forge [${correlationId}]`);
      const dreamResult = await this.executeEnginePhase('dream-forge', context, correlationId);
      console.log(`🎯 Phase 3 completed: ${dreamResult.success ? 'SUCCESS' : 'FAILED'} [${correlationId}]`);
      engineResults.push(dreamResult);
      if (dreamResult.success) executedEngines++; else failedEngines++;
      totalExecutionTime += dreamResult.executionTime;

      // Phase 4: Ethical Core (validation phase - critical)
      console.log(`🎯 Phase 4: Executing ethical-core [${correlationId}]`);
      const ethicalResult = await this.executeEnginePhase('ethical-core', context, correlationId);
      console.log(`🎯 Phase 4 completed: ${ethicalResult.success ? 'SUCCESS' : 'FAILED'} [${correlationId}]`);
      engineResults.push(ethicalResult);
      if (ethicalResult.success) executedEngines++; else failedEngines++;
      totalExecutionTime += ethicalResult.executionTime;

      // SSE-FIX-PURGE-AND-PATCH-FINAL: Phase 5 (Auto Optimization) COMPLETELY REMOVED
      // Phase 5: Auto Optimization (final optimization)
      // console.log(`🎯 Phase 5: Executing auto-optimization [${correlationId}]`);
      // const optimizationResult = await this.executeEnginePhase('auto-optimization', context, correlationId);
      // console.log(`🎯 Phase 5 completed: ${optimizationResult.success ? 'SUCCESS' : 'FAILED'} [${correlationId}]`);
      // engineResults.push(optimizationResult);
      // if (optimizationResult.success) executedEngines++; else failedEngines++;
      // totalExecutionTime += optimizationResult.executionTime;

      const finalResult = {
        // 🔧 FIX #5: Graceful degradation - tolerar hasta 2 fallos de 5 engines
        // Success si:
        // - No hay fallos críticos (ethical-core)
        // - Al menos 60% de engines funcionan
        // - O si solo auto-optimization falló por quota (no es un fallo real)
        success: this.countCriticalFailures(engineResults) === 0 && 
                (executedEngines >= this.engines.size * 0.6 || this.isOnlyQuotaFailure(engineResults)),
        degradedMode: failedEngines > 0 && !this.isOnlyQuotaFailure(engineResults), // ⭐ Flag de modo degradado
        executionTime: totalExecutionTime,
        correlationId,
        engineResults,
        orchestrationMetrics: {
          totalEngines: this.engines.size,
          executedEngines,
          failedEngines,
          averageExecutionTime: totalExecutionTime / executedEngines || 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };

      // Add error details if orchestration failed
      if (!finalResult.success) {
        (finalResult as any).error = new Error(
          `ORCHESTRATION_FAILED: ${failedEngines} out of ${this.engines.size} engines failed. ` +
          `Executed: ${executedEngines}, Failed: ${failedEngines}`
        );
      } else if ((finalResult as any).degradedMode) {
        console.warn(`⚠️ Orchestration succeeded in DEGRADED mode: ${failedEngines} engines failed`);
      } else if (failedEngines > 0 && this.isOnlyQuotaFailure(engineResults)) {
        console.log(`ℹ️ Orchestration succeeded: Auto-optimization quota reached (${failedEngines} engines in quota-limited state)`);
      }

      console.log(`✅ Orchestration phases completed [${correlationId}]: ${executedEngines} executed, ${failedEngines} failed`);
      return finalResult;

    } catch (phaseError) {
      console.error(`💥 Critical error in orchestration phases [${correlationId}]:`, phaseError);

      // Return a valid result even if phases failed catastrophically
      return {
        success: false,
        error: phaseError instanceof Error ? phaseError : new Error(String(phaseError) || 'Unknown phase error'),
        executionTime: totalExecutionTime,
        correlationId,
        engineResults,
        orchestrationMetrics: {
          totalEngines: this.engines.size,
          executedEngines,
          failedEngines: failedEngines + 1, // Count this as an additional failure
          averageExecutionTime: totalExecutionTime / Math.max(1, executedEngines),
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  private async executeEnginePhase(
    engineId: string,
    context: OrchestrationContext,
    correlationId: string
  ): Promise<any> {

    const engine = this.engines.get(engineId);
    if (!engine) {
      return {
        engineId,
        success: false,
        error: new Error(`ENGINE_NOT_FOUND: Engine ${engineId} not registered`),
        executionTime: 0,
        correlationId
      };
    }

    const startTime = Date.now();

    try {
      // Set orchestration context for adapters that need it
      if (engineId === 'dream-forge' && typeof (engine as any).setOrchestrationContext === 'function') {
        (engine as any).setOrchestrationContext(context);
      }

      // Create safety context for engine
      const safetyContext = {
        correlationId,
        timeoutMs: engine.config.timeoutMs,
        memoryLimitMB: engine.config.maxMemoryMB,
        circuitBreaker: this.safetyOrchestration.globalCircuitBreaker,
        backupEnabled: context.backupEnabled
      };

      console.log(`🔧 Executing engine ${engineId} with timeout ${safetyContext.timeoutMs}ms [${correlationId}]`);

      // Execute engine
      const result = await engine.execute(safetyContext);

      console.log(`🔧 Engine ${engineId} completed: success=${result.success}, executionTime=${Date.now() - startTime}ms [${correlationId}]`);

      if (!result.success && result.error) {
        console.error(`🔧 Engine ${engineId} failed with error: ${result.error.message} [${correlationId}]`, result.error);
      }

      return {
        engineId,
        success: result.success,
        result: result.success ? result.data : undefined,
        error: result.error instanceof Error ? result.error : (result.error ? new Error(String(result.error)) : undefined),
        executionTime: Date.now() - startTime,
        memoryUsed: result.memoryUsed,
        correlationId
      };

    } catch (error) {
      console.error(`🔧 Engine ${engineId} threw exception during execution [${correlationId}]:`, error);
      return {
        engineId,
        success: false,
        error: error instanceof Error ? error : new Error(String(error) || 'Unknown engine error'),
        executionTime: Date.now() - startTime,
        correlationId
      };
    }
  }

  private async updateGlobalHealth(): Promise<void> {
    this.safetyOrchestration.lastGlobalHealthCheck = new Date();

    // Reset global circuit breaker on successful orchestration
    if (this.safetyOrchestration.globalCircuitBreaker.failures > 0) {
      this.safetyOrchestration.globalCircuitBreaker.failures = 0;
      this.safetyOrchestration.globalCircuitBreaker.state = 'closed';
      console.log('✅ Global circuit breaker reset');
    }
  }

  // 🔧 FIX #5: Helper para contar fallos críticos (solo ethical-core es crítico)
  private countCriticalFailures(results: any[]): number {
    return results.filter(r => 
      !r.success && 
      (r.engineId === 'ethical-core') // Solo ethical-core es crítico
    ).length;
  }

  // 🔧 FIX #6: Helper para detectar si solo auto-optimization falló por quota
  private isOnlyQuotaFailure(results: any[]): boolean {
    const failedEngines = results.filter(r => !r.success);
    
    // Si solo hay 1 fallo y es auto-optimization, verificar si fue por quota
    if (failedEngines.length === 1 && failedEngines[0].engineId === 'auto-optimization') {
      const errorMessage = failedEngines[0].error?.message || '';
      // Si el mensaje indica quota reached, no es un fallo real
      return errorMessage.includes('quota') || errorMessage.includes('Suggestion quota reached');
    }
    
    return false;
  }

  private recordGlobalFailure(): void {
    this.safetyOrchestration.globalCircuitBreaker.failures++;

    if (this.safetyOrchestration.globalCircuitBreaker.failures >= 5) { // Global threshold
      this.safetyOrchestration.globalCircuitBreaker.state = 'open';
      this.safetyOrchestration.globalCircuitBreaker.nextAttemptTime = new Date(Date.now() + 300000); // 5 minutes
      console.error('🚨 GLOBAL CIRCUIT BREAKER OPENED due to repeated orchestration failures');
    }
  }

  private async emergencyShutdown(): Promise<void> {
    console.error('🚨 EMERGENCY SHUTDOWN initiated');

    this.safetyOrchestration.emergencyShutdown = true;

    // Cleanup all engines
    await this.cleanup();

    console.error('🚨 EMERGENCY SHUTDOWN completed');
  }

  // ===========================================
  // ABSTRACT METHODS - TO BE IMPLEMENTED BY SUBCLASSES
  // ===========================================

  /**
   * 🔧 Create engine instance (to be implemented by subclasses)
   */
  protected abstract createEngine(config: any): Promise<BaseMetaEngineImpl>;
}



