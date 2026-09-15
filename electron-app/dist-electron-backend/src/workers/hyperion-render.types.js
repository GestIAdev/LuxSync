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
/** Number of Float32 fields per fixture in the frame buffer.
 * 🩸 WAVE 7761 (Multi-RGB): 10 → 20. Stride PAR deliberado (no 19): evita
 * aritmetica impar del JIT y deja el slot 19 de reserva. El path legacy
 * (HyperionRenderBuffer) empaqueta 10 campos y los slots 10..19 quedan a 0
 * (zero-init de Float32Array) — compatible sin cambios.
 */
export const FLOATS_PER_FIXTURE = 20;
/** Field offsets within each fixture's 20-float block */
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
    // 🩸 WAVE 7761 (Multi-RGB): sub-zonas desagregadas (espejo de CELL_COLOR_BASE
    // del Glass, recompactado al stride del worker). 19 = spare.
    R_AMBIENT: 10,
    G_AMBIENT: 11,
    B_AMBIENT: 12,
    R_AIR: 13,
    G_AIR: 14,
    B_AIR: 15,
    R_STROBE: 16,
    G_STROBE: 17,
    B_STROBE: 18,
    // 🩸 WAVE 7761.6 (Fase 6): rotación cinética — spare slot 19 reutilizado.
    // FLOATS_PER_FIXTURE sigue en 20; el slot 19 era reserva y ahora porta rotation.
    ROTATION: 19,
};
