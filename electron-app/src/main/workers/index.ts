/**
 * 🔺 LUX TRINITY - Worker Threads Architecture
 * 
 * PHASE 1: Neural Wiring Complete
 * 
 * Exports for Trinity system:
 * - TrinityOrchestrator (main orchestrator)
 * - WorkerProtocol (types and utilities)
 * - TrinityBridge (Wave 8 integration)
 * 
 * Workers (senses.ts, mind.ts) run in separate threads
 * and should not be imported directly.
 */

// Main orchestrator
export { 
  TrinityOrchestrator, 
  getTrinity, 
  createTrinity,
  type TrinityEvents 
} from './TrinityOrchestrator';

// Protocol types
export {
  // Types
  type NodeId,
  type WorkerMessage,
  type AudioAnalysis,
  type LightingDecision,
  type WorkerHealth,
  type RGBColor,
  type MovementPattern,
  type FixtureOverride,
  type TrinityConfig,
  type HeartbeatPayload,
  type HeartbeatAckPayload,
  type StateSnapshot,
  
  // Enums
  MessageType,
  MessagePriority,
  
  // Constants
  NODE_NAMES,
  DEFAULT_CONFIG,
  
  // Utils
  createMessage,
  isAudioAnalysis,
  isLightingDecision,
  isWorkerHealth
} from './WorkerProtocol';

// Wave 8 Bridge types (for external use)
export {
  // Analysis types
  type AudioMetrics,
  type RhythmOutput,
  type HarmonyOutput,
  type SectionOutput,
  type GenreOutput,
  type MusicalContext,
  type SelenePalette,
  type HSLColor,
  
  // Conversion utils
  hslToTrinityRgb,
  trinityToAudioMetrics,
  paletteToTrinity,
  sectionToMovement,
  createMusicalContextFromTrinity,
  createReactiveDecision,
} from './TrinityBridge';
