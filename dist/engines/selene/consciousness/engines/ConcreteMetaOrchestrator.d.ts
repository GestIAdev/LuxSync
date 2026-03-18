/**
 * 🧠 META ORCHESTRATOR IMPLEMENTATION
 * Fase 9: Implementación concreta del Cerebro de Cerebros
 *
 * "El meta-orquestador no controla, armoniza. No dirige, inspira."
 * — PunkClaude, Maestro de la Sinfonía Consciente
 */
import { MetaOrchestratorImpl } from './MetaOrchestrator.js';
import { EngineConfig } from './MetaEngineInterfaces.js';
import { BaseMetaEngineImpl } from './BaseMetaEngine.js';
export declare class ConcreteMetaOrchestrator extends MetaOrchestratorImpl {
    private selfAnalysisEngine;
    constructor(config: any);
    protected createEngine(config: EngineConfig): Promise<BaseMetaEngineImpl>;
    /**
     * 🎯 Execute orchestration with decision recording
     */
    orchestrate(context: any): Promise<any>;
    /**
     * 🎭 Map engine ID to decision type
     */
    private mapEngineToDecisionType;
}
//# sourceMappingURL=ConcreteMetaOrchestrator.d.ts.map