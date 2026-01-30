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
export { TrinityOrchestrator, getTrinity, createTrinity } from './TrinityOrchestrator';
// Protocol types
export { 
// Enums
MessageType, MessagePriority, 
// Constants
NODE_NAMES, DEFAULT_CONFIG, 
// Utils
createMessage, isAudioAnalysis, isLightingDecision, isWorkerHealth } from './WorkerProtocol';
// Wave 8 Bridge types (for external use)
export { 
// Conversion utils
hslToTrinityRgb, trinityToAudioMetrics, paletteToTrinity, sectionToMovement, createMusicalContextFromTrinity, createReactiveDecision, } from './TrinityBridge';
