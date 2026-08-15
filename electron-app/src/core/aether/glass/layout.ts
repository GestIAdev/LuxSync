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

export const MAX_UNIVERSES    = 50
export const CHANNELS_PER_UNI = 512
export const DMX_DATA_BYTES   = MAX_UNIVERSES * CHANNELS_PER_UNI    // 25 600

export const DMX_HEADER_I32   = 16                                  // slots Int32
export const DMX_HEADER_BYTES = DMX_HEADER_I32 * 4                  // 64 bytes
export const DMX_SAB_BYTES    = DMX_HEADER_BYTES + DMX_DATA_BYTES   // 25 664 bytes

/**
 * Offsets del header del DMX_UNIVERSE_SAB (índices sobre Int32Array).
 *
 * SEQLOCK: par = frame estable; impar = escritura en curso.
 * UNIVERSE_MASK + UNIVERSE_MASK_HI: bitmask de 64 bits indicando qué
 *   universos se actualizaron en este frame (universo N → bit N).
 */
export const enum DmxHdr {
  SEQLOCK        = 0,
  FRAME_ID       = 1,
  UNIVERSE_MASK  = 2,
  UNIVERSE_MASK_HI = 3,
  ACTIVE_UNIS    = 4,
  TIMESTAMP_LO   = 5,
  TIMESTAMP_HI   = 6,
  // 7..15 reservados para expansión futura
}

// ═══════════════════════════════════════════════════════════════════════════
// GLASS VIEW — Float32Array layout constants
// Used by TickEngine._glassView and BufferPoolManager for the UI mirror.
// The fixture SAB (SharedArrayBuffer) infrastructure was removed (F3/F4):
// the UI mirror uses transferable ArrayBuffer ping-pong, not SAB.
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_FIXTURES     = 2048
export const FLOATS_PER_FIX   = 16                                   // 64 bytes/fixture
export const FIX_DATA_FLOATS  = MAX_FIXTURES * FLOATS_PER_FIX        // 32 768 floats
