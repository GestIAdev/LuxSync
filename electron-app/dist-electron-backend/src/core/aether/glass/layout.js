// ─────────────────────────────────────────────────────────────────────────────
// WAVE 6005 — GLASS MEMORY LAYOUT
// Constantes, offsets y enums matemáticos para los SharedArrayBuffers del
// "Puente de Cristal". Isomorfo: válido en Node, renderer y Web Workers.
// ─────────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// DMX_UNIVERSE_SAB
// Layout: [Header Int32 × 16][Data Uint8 × 25600]
// Total : 64 + 25 600 = 25 664 bytes (~25 KB)
// ═══════════════════════════════════════════════════════════════════════════
export const MAX_UNIVERSES = 50;
export const CHANNELS_PER_UNI = 512;
export const DMX_DATA_BYTES = MAX_UNIVERSES * CHANNELS_PER_UNI; // 25 600
export const DMX_HEADER_I32 = 16; // slots Int32
export const DMX_HEADER_BYTES = DMX_HEADER_I32 * 4; // 64 bytes
export const DMX_SAB_BYTES = DMX_HEADER_BYTES + DMX_DATA_BYTES; // 25 664 bytes
// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE_STATE_SAB
// Layout: [Header Int32 × 32][Data Float32 × (2048 × 16)]
// Total : 128 + 131 072 = 131 200 bytes (~128 KB)
// ═══════════════════════════════════════════════════════════════════════════
export const MAX_FIXTURES = 2048;
export const FLOATS_PER_FIX = 16; // 64 bytes/fixture
export const FIX_DATA_FLOATS = MAX_FIXTURES * FLOATS_PER_FIX; // 32 768 floats
export const FIX_HEADER_I32 = 32; // slots Int32
export const FIX_HEADER_BYTES = FIX_HEADER_I32 * 4; // 128 bytes
export const FIX_DATA_BYTES = FIX_DATA_FLOATS * 4; // 131 072 bytes
export const FIX_SAB_BYTES = FIX_HEADER_BYTES + FIX_DATA_BYTES; // 131 200 bytes
