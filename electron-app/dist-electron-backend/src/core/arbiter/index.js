/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MASTER ARBITER - BARREL EXPORT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 373: Central control hierarchy for LuxSync.
 *
 * @module core/arbiter
 * @version WAVE 373
 */
// ═══════════════════════════════════════════════════════════════════════════
// MAIN CLASS & SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
export { MasterArbiter, masterArbiter } from './MasterArbiter';
// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Enums
ControlLayer, DEFAULT_ARBITER_CONFIG, DEFAULT_MERGE_STRATEGIES, } from './types';
// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════
export { mergeHTP, mergeLTP, mergeBLEND, mergeOVERRIDE, mergeChannel, getDefaultStrategy, isHTPChannel, isLTPChannel, clampDMX, dmxToNormalized, normalizedToDMX, } from './merge/MergeStrategies';
// ═══════════════════════════════════════════════════════════════════════════
// CROSSFADE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export { CrossfadeEngine, globalCrossfadeEngine, easeInOutCubic, easeOutCubic, easeInCubic, linear, } from './CrossfadeEngine';
// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS (WAVE 376)
// ═══════════════════════════════════════════════════════════════════════════
export { registerArbiterHandlers, } from './ArbiterIPCHandlers';
