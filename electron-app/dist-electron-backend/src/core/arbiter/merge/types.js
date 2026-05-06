/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔀 MERGE CAPSULE — TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504: Types owned by the merge capsule.
 * These types model the INPUT contract of MergeStrategyResolver.
 * They are intentionally decoupled from the legacy ChannelValue in
 * ../types.ts — that type carries arbiter-internal layer metadata.
 *
 * LayerCandidate is the agnostic projection: a value + its layer priority.
 * MergeStrategyResolver only knows about numbers and priorities — never
 * about fixture state, singletons, or side-effects.
 *
 * @module core/arbiter/merge/types
 * @version WAVE 3504
 */
export {};
