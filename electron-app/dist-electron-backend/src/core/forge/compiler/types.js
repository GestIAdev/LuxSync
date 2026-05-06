/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE COMPILER — COMPILED GRAPH TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4a): Estructuras planas pre-allocated para evaluación
 * zero-alloc a 44Hz. Generadas en Patch Time por ForgeGraphCompiler.
 *
 * INVARIANTE: Nada en este archivo se instancia durante el hot-path.
 * Todo se construye UNA VEZ en compile() y se reutiliza frame a frame.
 *
 * @module core/forge/compiler/types
 * @version WAVE 4548.6
 */
/** Default ForgeFrameContext for initialization (all zeros). */
export const DEFAULT_FORGE_FRAME_CONTEXT = {
    timeMs: 0,
    deltaMs: 22.7,
    bpm: 120,
    bpmConfidence: 0,
    isBeat: false,
    energy: 0,
    audioBands: new Float64Array(6),
    frameIndex: 0,
};
