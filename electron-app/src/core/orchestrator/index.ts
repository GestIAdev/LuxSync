/**
 * 🌊 WAVE 237-243: ORCHESTRATOR MODULE
 * 
 * Exporta todos los componentes del orquestador TITAN 2.0
 * 
 * @module orchestrator
 */

// WAVE 237: IPC Handlers
export {
  setupIPCHandlers,
  setupVibeHandlers,
  setupAudioFrameHandlers,
} from './IPCHandlers'

export type {
  IPCDependencies,
  IPCState,
  IPCCallbacks,
  PatchedFixture,
  ManualOverride,
  FixtureState,
  FixtureZone,
  SeleneLuxInterface,
  EffectsEngineInterface,
  TrinityInterface,
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

// WAVE 243: Titan Orchestrator
export {
  TitanOrchestrator,
  getTitanOrchestrator,
  resetTitanOrchestrator,
} from './TitanOrchestrator'

export type {
  TitanConfig,
} from './TitanOrchestrator'
