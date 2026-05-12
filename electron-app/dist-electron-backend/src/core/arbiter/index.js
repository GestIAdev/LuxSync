/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🪦 ARBITER TYPES — Survivor barrel post WAVE 4704
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ArbitrationDirector, MasterArbiter, CrossfadeEngine, MergeStrategies y
 * LayerStateManager han sido eliminados físicamente en WAVE 4704.
 * Este barrel mantiene SOLO los tipos que aún tienen dependencias activas:
 *   - ControlLayer      → usado en HardwareAbstraction.ts
 *   - EffectIntent/Map  → usado en TitanOrchestrator + IntentComposer
 *   - Layer0_Titan, FinalLightingTarget, etc. → tipos de pipeline Aether
 *
 * @module core/arbiter
 * @version WAVE 4704 (RIP masterArbiter)
 */
// ═══════════════════════════════════════════════════════════════════════════
// TYPES (únicos supervivientes)
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Enums
ControlLayer, DEFAULT_ARBITER_CONFIG, DEFAULT_MERGE_STRATEGIES, } from './types';
