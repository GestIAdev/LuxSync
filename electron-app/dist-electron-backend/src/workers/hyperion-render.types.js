/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION RENDER WORKER — Shared Types
 * "El Contrato entre Main Thread y el 4th Worker"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tipos compartidos entre el main thread (TacticalCanvas.tsx) y el
 * RenderWorker (hyperion-render.worker.ts).
 *
 * REGLA: Este archivo NO importa NADA de React, DOM, o Zustand.
 * Solo tipos puros y constantes serializables.
 *
 * @module workers/hyperion-render.types
 * @since WAVE 2510 (Operación Hyperion — The 4th Worker)
 */
// ═══════════════════════════════════════════════════════════════════════════
// BUFFER LAYOUT — Constants for Float32Array packing
// ═══════════════════════════════════════════════════════════════════════════
/** Number of Float32 fields per fixture in the frame buffer */
export const FLOATS_PER_FIXTURE = 10;
/** Field offsets within each fixture's 10-float block */
export const FIXTURE_FIELD = {
    R: 0,
    G: 1,
    B: 2,
    INTENSITY: 3,
    PHYSICAL_PAN: 4,
    PHYSICAL_TILT: 5,
    ZOOM: 6,
    FOCUS: 7,
    PAN_VELOCITY: 8,
    TILT_VELOCITY: 9,
};
