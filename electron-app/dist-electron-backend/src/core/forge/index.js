/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE GRAPH — PUBLIC API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.2: Barrel export for the Forge Node Graph kernel.
 *
 * @module core/forge
 * @version WAVE 4548.2
 */
// ── Builder ──────────────────────────────────────────────────────────────
export { NodeGraphBuilder } from './NodeGraphBuilder';
// ── Compiler (Patch Time) ────────────────────────────────────────────────
export { ForgeGraphCompiler } from './compiler/ForgeGraphCompiler';
export { AUDIO_BAND_INDEX } from './compiler/ForgeGraphCompiler';
export { DEFAULT_FORGE_FRAME_CONTEXT } from './compiler/types';
// ── Evaluator (Hot-Path) ─────────────────────────────────────────────────
export { ForgeNodeEvaluator } from './evaluator/ForgeNodeEvaluator';
export { OPCODE_TABLE } from './evaluator/opcodes';
// ── Ingenio Ecosystem (WAVE 4549.1) ─────────────────────────────────────
export { IngenioFactory } from './ingenio/IngenioFactory';
