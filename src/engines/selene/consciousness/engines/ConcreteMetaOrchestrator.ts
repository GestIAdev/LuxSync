/**
 * 🧠 META ORCHESTRATOR IMPLEMENTATION
 * Fase 9: Implementación concreta del Cerebro de Cerebros
 *
 * "El meta-orquestador no controla, armoniza. No dirige, inspira."
 * — PunkClaude, Maestro de la Sinfonía Consciente
 */

import { MetaOrchestratorImpl } from './MetaOrchestrator.js';
import { SelfAnalysisEngine } from './SelfAnalysisEngine.js';
import { PatternEmergenceEngine } from './PatternEmergenceEngine.js';
import { DreamForgeEngine } from './DreamForgeEngine.js';
import { EthicalCoreEngine } from './EthicalCoreEngine.js';
import { AutoOptimizationEngine } from './AutoOptimizationEngine.js';
import { EngineConfig } from './MetaEngineInterfaces.js';
import { BaseMetaEngineImpl } from './BaseMetaEngine.js';


/**
 * 🔧 ENGINE ADAPTER - Adapta engines simples a la interfaz BaseMetaEngineImpl
 */
class MetaEngineAdapter extends BaseMetaEngineImpl {
  private engine: any;
  private orchestrationContext: any = null;

  constructor(engine: any, config: EngineConfig) {
    super(config);
    this.engine = engine;
  }

  /**
   * Set the orchestration context for this execution
   */
  setOrchestrationContext(context: any): void {
    this.orchestrationContext = context;
  }

  protected async executeWithSafety(context: any): Promise<any> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Ejecutar lógica específica del engine
      const result = await this.executeEngineLogic(context);

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory,
        correlationId: context.correlationId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error) || 'Unknown engine logic error'),
        executionTime: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory,
        correlationId: context.correlationId
      };
    }
  }

  private async executeEngineLogic(context: any): Promise<any> {
    const engineId = this.config.id;

    // Check if the engine implements BaseMetaEngine (has execute method)
    if (typeof this.engine.execute === 'function') {
      // Engine implements BaseMetaEngine, call its execute method
      return await this.engine.execute(context);
    }

    // Fallback for simple engines that don't implement BaseMetaEngine
    switch (engineId) {
      case 'self-analysis':
        return this.engine.analyzeSelf();

      case 'pattern-emergence':
        // PatternEmergenceEngine implements BaseMetaEngine, but just in case
        return this.engine.analyzePatterns(context);

      case 'dream-forge':
        // DreamForgeEngine has forgeDreams method
        if (!this.orchestrationContext) {
          throw new Error('Orchestration context not set for dream-forge engine');
        }
        return this.engine.forgeDreams(
          this.orchestrationContext.currentState || {},
          this.orchestrationContext.desiredOutcome || {}
        );

      case 'ethical-core':
        // EthicalCoreEngine implements BaseMetaEngine, but just in case
        return this.engine.evaluateEthicalDilemma(context);

      // SSE-FIX-PURGE-AND-PATCH-FINAL: AutoOptimizationEngine REMOVED
      // case 'auto-optimization':
      //   // AutoOptimizationEngine implements BaseMetaEngine, but just in case
      //   return this.engine.optimize(context);

      default:
        throw new Error(`Engine ${engineId} does not implement BaseMetaEngine interface and has no fallback logic`);
    }
  }

  protected async onInitialize(): Promise<void> {
    // Los engines simples no necesitan inicialización especial
  }

  protected async onCleanup(): Promise<void> {
    // 🔧 FIX #6: Cleanup recursivo del engine wrapeado
    if (this.engine && typeof this.engine.cleanup === 'function') {
      try {
        await this.engine.cleanup();
        console.log(`✅ Wrapped engine ${this.config.id} cleaned up`);
      } catch (error) {
        console.error(`💥 Failed to cleanup wrapped engine ${this.config.id}:`, error as Error);
      }
    }

    // ⭐ Limpiar arrays/maps grandes del engine para prevenir memory leaks
    if (this.engine) {
      // SelfAnalysisEngine
      if (this.engine.cognitiveHistory && Array.isArray(this.engine.cognitiveHistory)) {
        this.engine.cognitiveHistory = [];
      }
      // PatternEmergenceEngine
      if (this.engine.observations && Array.isArray(this.engine.observations)) {
        this.engine.observations = [];
      }
      // SSE-FIX-ALL: AutoOptimizationEngine cleanup removed (engine no longer exists)
    }

    // ⭐ Nullificar referencia del engine
    this.engine = null;
  }
}

export class ConcreteMetaOrchestrator extends MetaOrchestratorImpl {
  private selfAnalysisEngine: SelfAnalysisEngine | null = null;

  constructor(config: any) {
    super(config);
  }

  protected async createEngine(config: EngineConfig): Promise<BaseMetaEngineImpl> {
    let simpleEngine: any;

    switch (config.id) {
      case 'self-analysis':
        this.selfAnalysisEngine = new SelfAnalysisEngine(config);
        simpleEngine = this.selfAnalysisEngine;
        break;
      case 'pattern-emergence':
        simpleEngine = new PatternEmergenceEngine(config);
        break;
      case 'dream-forge':
        simpleEngine = new DreamForgeEngine();
        break;
      case 'ethical-core':
        simpleEngine = new EthicalCoreEngine(config);
        break;
      // SSE-FIX-ALL: AutoOptimizationEngine REMOVED - Now runs independently via EvolutionaryAutoOptimizationEngine
      // Old AutoOptimizationEngine caused conflicts with Synergy Engine suggestions
      // case 'auto-optimization':
      //   simpleEngine = new AutoOptimizationEngine(config);
      //   break;
      default:
        throw new Error(`Unknown engine type: ${config.id}`);
    }

    // Wrap the simple engine with the adapter
    const adapter = new MetaEngineAdapter(simpleEngine, config);

    // Initialize the adapter if it has an initialize method
    if (typeof adapter.initialize === 'function') {
      await adapter.initialize();
    }

    return adapter;
  }

  /**
   * 🎯 Execute orchestration with decision recording
   */
  async orchestrate(context: any): Promise<any> {
    try {
      // Execute normal orchestration
      const result = await super.orchestrate(context);

      // Ensure we always return a valid result object
      if (!result || typeof result !== 'object') {
        console.error('🧠 [META-ORCHESTRATOR] Orchestration returned invalid result:', JSON.stringify(result));
        return {
          success: false,
          error: new Error('ORCHESTRATION_INVALID_RESULT: Orchestration returned undefined or invalid result'),
          executionTime: 0,
          correlationId: context?.correlationId || 'unknown',
          engineResults: [],
          orchestrationMetrics: {
            totalEngines: 0,
            executedEngines: 0,
            failedEngines: 1,
            averageExecutionTime: 0,
            memoryUsage: process.memoryUsage().heapUsed
          }
        };
      }

      // Record decisions for self-analysis if engine is available
      if (this.selfAnalysisEngine && result.engineResults) {
        for (const engineResult of result.engineResults) {
          // Record decision based on engine execution result
          const decisionType = this.mapEngineToDecisionType(engineResult.engineId);
          const success = engineResult.success;
          const processingTime = engineResult.executionTime || 0;

          // Create context based on result
          const decisionContext = {
            confidence: success ? 0.8 : 0.3,
            risk: success ? 0.2 : 0.7,
            engineId: engineResult.engineId,
            hasError: !!engineResult.error
          };

          this.selfAnalysisEngine.recordDecision(
            decisionType,
            success,
            processingTime,
            decisionContext
          );
        }
      }

      return result;
    } catch (error) {
      console.error('🧠 [META-ORCHESTRATOR] Orchestration failed with exception:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error) || 'Unknown orchestration exception'),
        executionTime: 0,
        correlationId: context?.correlationId || 'unknown',
        engineResults: [],
        orchestrationMetrics: {
          totalEngines: 0,
          executedEngines: 0,
          failedEngines: 1,
          averageExecutionTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * 🎭 Map engine ID to decision type
   */
  private mapEngineToDecisionType(engineId: string): 'decision' | 'prediction' | 'optimization' | 'ethical' {
    switch (engineId) {
      case 'self-analysis':
        return 'decision';
      case 'pattern-emergence':
        return 'prediction';
      case 'dream-forge':
        return 'prediction';
      case 'ethical-core':
        return 'ethical';
      // SSE-FIX-PURGE-AND-PATCH-FINAL: AutoOptimizationEngine REMOVED
      // case 'auto-optimization':
      //   return 'optimization';
      default:
        return 'decision';
    }
  }
}


