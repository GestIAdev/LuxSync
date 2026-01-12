/**
 * WAVE 243.5: ORCHESTRATOR MODULE
 * 
 * Exporta todos los componentes del orquestador TITAN 2.0
 * 
 * @module orchestrator
 */

// WAVE 243.5: IPC Handlers (Simplified V2)
export {
  setupIPCHandlers,
} from './IPCHandlers'

export type {
  IPCDependencies,
  FixtureZone,
} from './IPCHandlers'

// WAVE 240: Event Router
export {
  EventRouter,
  getEventRouter,
  resetEventRouter,
} from './EventRouter'

export type {
  EventRouterEvents,
  AudioAnalysis,
  DMXPacket,
  BrainModule,
  EngineModule,
  HALModule,
} from './EventRouter'

// WAVE 243.5: Titan Orchestrator (Simplified V2)
export {
  TitanOrchestrator,
  getTitanOrchestrator,
} from './TitanOrchestrator'

export type {
  TitanConfig,
} from './TitanOrchestrator'

// 🎭 WAVE 374: Arbiter Handlers
export {
  setupArbiterHandlers,
} from './ArbiterHandlers'
