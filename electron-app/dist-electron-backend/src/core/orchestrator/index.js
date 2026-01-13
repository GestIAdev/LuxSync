/**
 * WAVE 243.5: ORCHESTRATOR MODULE
 *
 * Exporta todos los componentes del orquestador TITAN 2.0
 *
 * @module orchestrator
 */
// WAVE 243.5: IPC Handlers (Simplified V2)
export { setupIPCHandlers, } from './IPCHandlers';
// WAVE 240: Event Router
export { EventRouter, getEventRouter, resetEventRouter, } from './EventRouter';
// WAVE 243.5: Titan Orchestrator (Simplified V2)
export { TitanOrchestrator, getTitanOrchestrator, registerTitanOrchestrator, // WAVE 380: Register singleton from main.ts
 } from './TitanOrchestrator';
// 🎭 WAVE 374: Arbiter Handlers
export { setupArbiterHandlers, } from './ArbiterHandlers';
